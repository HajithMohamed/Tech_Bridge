import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import MessagingSettings from '../models/MessagingSettings';
import User from '../models/User';
import { listCommunityPeople } from './communityController';
import { AdminActionError } from '../services/adminUsers';
import { beginConversation, writeMessage, participant, lockMessagingUser, messagingTransactionOptions, authorizeTyping } from '../services/messaging';
import { messageId, messagePage, messagePreferences, messageText, escapedSearch } from '../services/messagingPolicy';
import { openMessageStream, publishMessageSignal } from '../services/messageEvents';

export const messagingFailure = (res: Response, error: unknown) => {
  const status = error instanceof AdminActionError ? error.statusCode : 503;
  if (status === 429) res.set('Retry-After', '60');
  res.status(status).json({ success: false, message: error instanceof AdminActionError ? error.message : 'Messaging is temporarily unavailable. Please try again.' });
};
export const startConversation = async (req: Request, res: Response) => {
  try {
    const conversation = await beginConversation(req.user!._id, messageId(req.body?.recipientId));
    await publishMessageSignal(conversation.participantIds.map(String));
    res.status(201).json({ success: true, data: { conversation } });
  } catch (error) { messagingFailure(res, error); }
};
export const listConversations = async (req: Request, res: Response) => {
  try {
    const page = messagePage(req.query.page); const q = escapedSearch(req.query.q); const ownerId = req.user!._id;
    const result = await Conversation.aggregate([
      { $match: { participantIds: ownerId } },
      { $sort: { lastMessageAt: -1, createdAt: -1, _id: -1 } },
      { $lookup: { from: 'users', let: { others: '$participantIds' }, pipeline: [
        { $match: { $expr: { $and: [{ $in: ['$_id', '$$others'] }, { $ne: ['$_id', ownerId] }] } } },
        { $project: { fullName: 1, role: 1, 'providerProfile.organizationName': 1, 'providerProfile.organizationType': 1 } },
      ], as: 'otherParticipant' } },
      { $unwind: { path: '$otherParticipant', preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: { $or: [{ 'otherParticipant.fullName': { $regex: q, $options: 'i' } }, { 'otherParticipant.providerProfile.organizationName': { $regex: q, $options: 'i' } }] } }] : []),
      { $facet: { rows: [{ $skip: (page - 1) * 20 }, { $limit: 20 }], total: [{ $count: 'count' }] } },
    ]);
    const rows = result[0].rows; const total = result[0].total[0]?.count || 0; const conversationIds = rows.map((row: { _id: mongoose.Types.ObjectId }) => row._id);
    const [latest, unread, settings] = await Promise.all([
      Message.aggregate([{ $match: { conversationId: { $in: conversationIds } } }, { $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: '$conversationId', content: { $first: '$content' } } }]),
      Message.aggregate([{ $match: { conversationId: { $in: conversationIds }, senderId: { $ne: ownerId }, readAt: { $exists: false } } }, { $group: { _id: '$conversationId', count: { $sum: 1 } } }]),
      MessagingSettings.findOne({ ownerId }),
    ]);
    const previews = new Map(latest.map((row) => [String(row._id), row.content])); const counts = new Map(unread.map((row) => [String(row._id), row.count]));
    res.json({ success: true, data: { conversations: rows.map((row: { _id: mongoose.Types.ObjectId; otherParticipant?: { _id: mongoose.Types.ObjectId } }) => ({ ...row, lastMessagePreview: previews.get(String(row._id)) || '', unreadCount: counts.get(String(row._id)) || 0, blockedByMe: Boolean(settings?.blockedIds.some((id) => id.equals(row.otherParticipant?._id))) })), page, total, pages: Math.max(1, Math.ceil(total / 20)) } });
  } catch (error) { messagingFailure(res, error); }
};
export const listConversationMessages = async (req: Request, res: Response) => {
  try {
    const id = messageId(req.params.id); const conversation = await Conversation.findOne({ _id: id, participantIds: req.user!._id });
    if (!conversation) throw new AdminActionError(404, 'Conversation not found.');
    const page = messagePage(req.query.page);
    const filter: mongoose.FilterQuery<unknown> = { conversationId: id };
    if (req.query.before !== undefined) {
      if (req.query.page !== undefined) throw new AdminActionError(400, 'Choose a page or an older-message cursor.');
      const before = await Message.findOne({ _id: messageId(req.query.before), conversationId: id });
      if (!before) throw new AdminActionError(400, 'Invalid older-message cursor.');
      filter.$or = [{ createdAt: { $lt: before.createdAt } }, { createdAt: before.createdAt, _id: { $lt: before._id } }];
    }
    const rows = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).skip(req.query.before ? 0 : (page - 1) * 40).limit(41);
    const hasMore = rows.length > 40; const messages = rows.slice(0, 40).reverse();
    res.json({ success: true, data: { messages, page, hasMore, nextBefore: hasMore ? String(messages[0]._id) : null } });
  } catch (error) { messagingFailure(res, error); }
};
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const result = await writeMessage(messageId(req.params.id), req.user!._id, messageText(req.body?.content));
    await publishMessageSignal(result.participantIds.map(String));
    res.status(201).json({ success: true, data: { message: result.message } });
  } catch (error) { messagingFailure(res, error); }
};
export const markConversationRead = async (req: Request, res: Response) => {
  try {
    const id = messageId(req.params.id); const conversation = await Conversation.findById(id);
    if (!conversation || !participant(conversation, req.user!._id)) throw new AdminActionError(404, 'Conversation not found.');
    const through = req.body?.throughId === undefined ? await Message.findOne({ conversationId: id }).sort({ createdAt: -1, _id: -1 }) : await Message.findOne({ _id: messageId(req.body.throughId), conversationId: id });
    if (req.body?.throughId !== undefined && !through) throw new AdminActionError(400, 'Invalid read receipt.');
    if (through) {
      const update = await Message.updateMany({ conversationId: id, senderId: { $ne: req.user!._id }, readAt: { $exists: false }, $or: [{ createdAt: { $lt: through.createdAt } }, { createdAt: through.createdAt, _id: { $lte: through._id } }] }, { $set: { readAt: new Date() } });
      if (update.modifiedCount) await publishMessageSignal(conversation.participantIds.map(String));
    }
    res.json({ success: true });
  } catch (error) { messagingFailure(res, error); }
};
export const getMessagingSettings = async (req: Request, res: Response) => {
  try {
    const row = await MessagingSettings.findOne({ ownerId: req.user!._id });
    const blockedUsers = await User.find({ _id: { $in: row?.blockedIds || [] } }).select('_id fullName').lean();
    res.json({ success: true, data: { acceptsMessages: row?.acceptsMessages ?? true, notifications: row?.notifications ?? true, blockedUsers } });
  } catch (error) { messagingFailure(res, error); }
};
export const messagingSummary = async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!._id;
    const [row, counts] = await Promise.all([MessagingSettings.findOne({ ownerId }), Conversation.aggregate([
      { $match: { participantIds: ownerId } },
      { $lookup: { from: 'messages', let: { conversation: '$_id' }, pipeline: [
        { $match: { readAt: { $exists: false }, senderId: { $ne: ownerId }, $expr: { $eq: ['$conversationId', '$$conversation'] } } }, { $count: 'count' },
      ], as: 'unread' } },
      { $group: { _id: null, count: { $sum: { $ifNull: [{ $arrayElemAt: ['$unread.count', 0] }, 0] } } } },
    ])]);
    const unread = counts[0]?.count || 0;
    res.json({ success: true, data: { unread, notifications: row?.notifications ?? true } });
  } catch (error) { messagingFailure(res, error); }
};
export const updateMessagingSettings = async (req: Request, res: Response) => {
  try {
    const values = messagePreferences(req.body);
    await mongoose.connection.transaction(async (session) => {
      await lockMessagingUser(req.user!._id, session);
      await MessagingSettings.updateOne({ ownerId: req.user!._id }, { $set: values }, { upsert: true, session, runValidators: true });
    }, messagingTransactionOptions);
    await publishMessageSignal([String(req.user!._id)]);
    res.json({ success: true });
  } catch (error) { messagingFailure(res, error); }
};
export const blockMember = (block: boolean) => async (req: Request, res: Response) => {
  try {
    const otherId = messageId(req.params.id); if (otherId.equals(req.user!._id)) throw new AdminActionError(400, 'Choose another member.');
    await mongoose.connection.transaction(async (session) => {
      await lockMessagingUser(req.user!._id, session);
      if (block && !await User.exists({ _id: otherId }).session(session)) throw new AdminActionError(404, 'Member not found.');
      const row = await MessagingSettings.findOne({ ownerId: req.user!._id }).session(session);
      if (block && row && !row.blockedIds.some((id) => id.equals(otherId)) && row.blockedIds.length >= 200) throw new AdminActionError(409, 'You can block up to 200 members.');
      await MessagingSettings.updateOne({ ownerId: req.user!._id }, block ? { $addToSet: { blockedIds: otherId } } : { $pull: { blockedIds: otherId } }, { upsert: true, session });
    }, messagingTransactionOptions);
    await publishMessageSignal([String(req.user!._id)]);
    res.json({ success: true });
  } catch (error) { messagingFailure(res, error); }
};
export const typing = async (req: Request, res: Response) => {
  try {
    const conversationId = messageId(req.params.id); const otherId = await authorizeTyping(conversationId, req.user!._id);
    await publishMessageSignal([String(otherId)], { type: 'typing', conversationId: String(conversationId), expiresAt: Date.now() + 4000 });
    res.json({ success: true });
  } catch (error) { messagingFailure(res, error); }
};
export const messageStream = (req: Request, res: Response) => { try { openMessageStream(req, res); } catch (error) { messagingFailure(res, error); } };
export const listMentors = listCommunityPeople;
