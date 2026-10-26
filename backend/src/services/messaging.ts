import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import MessagingSettings from '../models/MessagingSettings';
import Application from '../models/Application';
import ResourceRequest from '../models/ResourceRequest';
import PromotionRequest from '../models/PromotionRequest';
import { AdminActionError } from './adminUsers';
import { assertCommunityMessaging, communityPair } from './communityMessaging';
import { assertContactPreferences } from './messagingPolicy';

export const messagingTransactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export const keyFor = (a: Types.ObjectId, b: Types.ObjectId) => [String(a), String(b)].sort().join(':');
export const participant = (conversation: { participantIds: Types.ObjectId[] }, id: Types.ObjectId) => conversation.participantIds.some((value) => value.equals(id));

export async function lockMessagingUser(id: Types.ObjectId, session: ClientSession) {
  const user = await User.findOneAndUpdate({ _id: id, accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
  if (!user || (user.role === 'provider' && (!user.providerProfile?.verified || user.providerProfile.verificationStatus !== 'VERIFIED'))) throw new AdminActionError(403, 'Messaging is unavailable for this account.');
  return user;
}
async function relationship(first: IUser, second: IUser, session: ClientSession) {
  const student = first.role === 'student' ? first : second.role === 'student' ? second : null;
  const provider = first.role === 'provider' ? first : second.role === 'provider' ? second : null;
  if (!student || !provider) return false;
  const pair = { studentId: student._id, providerId: provider._id };
  // Sequential operations on one transaction session.
  if (await Application.exists({ ...pair, status: { $ne: 'rejected' } }).session(session)) return true;
  if (await ResourceRequest.exists({ ...pair, status: { $ne: 'rejected' } }).session(session)) return true;
  return Boolean(await PromotionRequest.exists({ ...pair, status: { $in: ['accepted', 'completed'] } }).session(session));
}
async function authorizePair(senderId: Types.ObjectId, otherId: Types.ObjectId, conversation: { _id: Types.ObjectId; initiatedBy?: Types.ObjectId } | null, session: ClientSession) {
  if (senderId.equals(otherId)) throw new AdminActionError(400, 'Choose another member.');
  const users: IUser[] = [];
  for (const id of [senderId, otherId].sort((a, b) => String(a).localeCompare(String(b)))) users.push(await lockMessagingUser(id, session));
  const sender = users.find((user) => user._id.equals(senderId))!;
  const other = users.find((user) => user._id.equals(otherId))!;
  const settings = await MessagingSettings.find({ ownerId: { $in: [senderId, otherId] } }).session(session);
  assertContactPreferences(settings, senderId, otherId);
  if (communityPair(sender, other)) await assertCommunityMessaging(senderId, otherId, conversation, session);
  else if (sender.role !== 'admin' && !(conversation && other.role === 'admin') && !await relationship(sender, other, session)) throw new AdminActionError(403, 'An active application, resource request or accepted collaboration is required.');
  return { sender, other };
}
export async function beginConversation(senderId: Types.ObjectId, otherId: Types.ObjectId) {
  return mongoose.connection.transaction(async (session) => {
    const participantKey = keyFor(senderId, otherId);
    const existing = await Conversation.findOne({ participantKey }).session(session);
    await authorizePair(senderId, otherId, existing, session);
    if (existing) return existing;
    const count = await Conversation.countDocuments({ initiatedBy: senderId, createdAt: { $gt: new Date(Date.now() - 3600_000) } }).session(session);
    if (count >= 10) throw new AdminActionError(429, 'New conversation limit reached. Try again in an hour.');
    const [created] = await Conversation.create([{ participantIds: [senderId, otherId], participantKey, initiatedBy: senderId }], { session });
    return created;
  }, messagingTransactionOptions);
}
export async function writeMessage(conversationId: Types.ObjectId, senderId: Types.ObjectId, content: string) {
  return mongoose.connection.transaction(async (session) => {
    const conversation = await Conversation.findOne({ _id: conversationId, participantIds: senderId }).session(session);
    if (!conversation) throw new AdminActionError(404, 'Conversation not found.');
    const otherId = conversation.participantIds.find((id) => !id.equals(senderId))!;
    await authorizePair(senderId, otherId, conversation, session);
    const now = Date.now();
    const minute = await Message.countDocuments({ senderId, createdAt: { $gt: new Date(now - 60_000) } }).session(session);
    const hour = await Message.countDocuments({ senderId, createdAt: { $gt: new Date(now - 3600_000) } }).session(session);
    if (minute >= 20 || hour >= 100) throw new AdminActionError(429, 'Message limit reached. Please wait before sending again.');
    const [message] = await Message.create([{ conversationId, senderId, content }], { session });
    await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: message.createdAt } }, { session });
    return { message, participantIds: conversation.participantIds };
  }, messagingTransactionOptions);
}
export async function authorizeTyping(conversationId: Types.ObjectId, senderId: Types.ObjectId) {
  return mongoose.connection.transaction(async (session) => {
    const conversation = await Conversation.findOne({ _id: conversationId, participantIds: senderId }).session(session);
    if (!conversation) throw new AdminActionError(404, 'Conversation not found.');
    const otherId = conversation.participantIds.find((id) => !id.equals(senderId))!;
    await authorizePair(senderId, otherId, conversation, session);
    // A shared database timestamp makes typing limits effective across workers.
    const now = new Date();
    const update = await User.updateOne({ _id: senderId, $or: [{ lastTypingAt: { $exists: false } }, { lastTypingAt: { $lte: new Date(now.getTime() - 2000) } }] }, { $set: { lastTypingAt: now } }, { session, timestamps: false });
    if (!update.modifiedCount) throw new AdminActionError(429, 'Typing updates are limited to one every two seconds.');
    return otherId;
  }, messagingTransactionOptions);
}
