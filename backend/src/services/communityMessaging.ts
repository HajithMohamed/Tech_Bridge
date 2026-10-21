import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { CommunityClaim } from '../models/CommunityClaim';
import { communityVisible } from './communityPolicy';
import { AdminActionError } from './adminUsers';

export function communityPair(first: Pick<IUser, 'role' | 'providerProfile'>, second: Pick<IUser, 'role' | 'providerProfile'>) {
  const facultyType = (user: typeof first) => ['faculty', 'alumni'].includes(user.providerProfile?.organizationType || '');
  return (first.role === 'student' && facultyType(second)) || (second.role === 'student' && facultyType(first));
}
async function pairFor(first: Types.ObjectId, second: Types.ObjectId) {
  const users = await User.find({ _id: { $in: [first, second] } });
  return users.length === 2 && communityPair(users[0], users[1]);
}
async function lockPair(senderId: Types.ObjectId, otherId: Types.ObjectId, session: ClientSession) {
  const users: IUser[] = [];
  for (const id of [senderId, otherId].sort((a, b) => a.toString().localeCompare(b.toString()))) {
    const user = await User.findOneAndUpdate({ _id: id, accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!user) throw new AdminActionError(403, 'Community messaging is unavailable for this account.');
    users.push(user);
  }
  const student = users.find((user) => user.role === 'student'); const provider = users.find((user) => user._id.toString() !== student?._id.toString());
  if (!student || !provider) throw new AdminActionError(403, 'Community messaging requires a student and a verified faculty/alumni member.');
  // Preference updates and provider identity/verification updates take the same
  // provider lock, so a send cannot commit after a conflicting withdrawal.
  const claim = await CommunityClaim.findOneAndUpdate({ providerId: provider._id }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
  if (!communityVisible(provider, claim) || !claim?.profile.acceptsStudentMessages) throw new AdminActionError(403, 'This member is not currently accepting student messages.');
  return { student, provider };
}
const options = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
async function studentParticipated(conversation: { _id: Types.ObjectId; initiatedBy?: Types.ObjectId } | null, studentId: Types.ObjectId, session: ClientSession) {
  return conversation && (conversation.initiatedBy?.equals(studentId) || Boolean(await Message.exists({ conversationId: conversation._id, senderId: studentId }).session(session)));
}
export async function startCommunityConversation(senderId: Types.ObjectId, recipientId: Types.ObjectId) {
  if (!await pairFor(senderId, recipientId)) return null;
  return mongoose.connection.transaction(async (session) => {
    const { student } = await lockPair(senderId, recipientId, session);
    const participantKey = [senderId.toString(), recipientId.toString()].sort().join(':');
    const existing = await Conversation.findOne({ participantKey }).session(session);
    if (!senderId.equals(student._id) && !await studentParticipated(existing, student._id, session)) throw new AdminActionError(403, 'The student must initiate the community conversation.');
    if (existing) return existing;
    const [conversation] = await Conversation.create([{ participantIds: [senderId, recipientId], participantKey, initiatedBy: senderId }], { session });
    return conversation;
  }, options);
}
export async function sendCommunityMessage(conversationId: Types.ObjectId, senderId: Types.ObjectId, otherId: Types.ObjectId, content: string) {
  if (!await pairFor(senderId, otherId)) return null;
  return mongoose.connection.transaction(async (session) => {
    const { student } = await lockPair(senderId, otherId, session);
    const conversation = await Conversation.findOne({ _id: conversationId, participantIds: { $all: [senderId, otherId] } }).session(session);
    if (!conversation) throw new AdminActionError(404, 'Conversation not found.');
    if (!senderId.equals(student._id) && !await studentParticipated(conversation, student._id, session)) throw new AdminActionError(403, 'The student must initiate the community conversation.');
    const [message] = await Message.create([{ conversationId, senderId, content }], { session });
    await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: message.createdAt } }, { session });
    return message;
  }, options);
}
