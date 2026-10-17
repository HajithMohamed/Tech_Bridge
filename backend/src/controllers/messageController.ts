import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Application from '../models/Application';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import PromotionRequest from '../models/PromotionRequest';
import ResourceRequest from '../models/ResourceRequest';
import User from '../models/User';

const keyFor = (first: mongoose.Types.ObjectId, second: mongoose.Types.ObjectId) => [first.toString(), second.toString()].sort().join(':');
const isParticipant = (conversation: { participantIds: mongoose.Types.ObjectId[] }, userId: mongoose.Types.ObjectId) => conversation.participantIds.some((id) => id.equals(userId));

const mayStartConversation = async (senderId: mongoose.Types.ObjectId, recipientId: mongoose.Types.ObjectId): Promise<boolean> => {
  const [sender, recipient] = await Promise.all([User.findById(senderId), User.findById(recipientId)]);
  if (!sender || !recipient) return false;
  if (sender.role === 'admin') return true;
  if (recipient.accountStatus !== 'active') return false;
  if (sender.role === 'student' && recipient.role === 'provider') {
    if (recipient.providerProfile?.verified && ['alumni', 'faculty'].includes(recipient.providerProfile.organizationType)) return true;
    const [application, request, promotionRequest] = await Promise.all([
      Application.exists({ studentId: senderId, providerId: recipientId, status: { $ne: 'rejected' } }),
      ResourceRequest.exists({ studentId: senderId, providerId: recipientId, status: { $ne: 'rejected' } }),
      PromotionRequest.exists({ studentId: senderId, providerId: recipientId, status: { $in: ['accepted', 'completed'] } }),
    ]);
    return Boolean(application || request || promotionRequest);
  }
  if (sender.role === 'provider' && recipient.role === 'student') {
    const [application, request, promotionRequest] = await Promise.all([
      Application.exists({ studentId: recipientId, providerId: senderId, status: { $ne: 'rejected' } }),
      ResourceRequest.exists({ studentId: recipientId, providerId: senderId, status: { $ne: 'rejected' } }),
      PromotionRequest.exists({ studentId: recipientId, providerId: senderId, status: { $in: ['accepted', 'completed'] } }),
    ]);
    return Boolean(application || request || promotionRequest);
  }
  return false;
};

export const startConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipientId } = req.body;
    if (!mongoose.isValidObjectId(recipientId) || req.user!._id.toString() === recipientId) { res.status(400).json({ success: false, message: 'Choose another valid user.' }); return; }
    const allowed = await mayStartConversation(req.user!._id, new mongoose.Types.ObjectId(recipientId));
    if (!allowed) { res.status(403).json({ success: false, message: 'You can only message verified faculty/alumni or a provider/student connected through an application, resource request, or accepted promotion request.' }); return; }
    const participantIds = [req.user!._id, new mongoose.Types.ObjectId(recipientId)];
    const participantKey = keyFor(participantIds[0], participantIds[1]);
    let conversation = await Conversation.findOne({ participantKey });
    if (!conversation) {
      try { conversation = await Conversation.create({ participantIds, participantKey }); }
      catch (error: unknown) {
        if ((error as { code?: number }).code === 11000) conversation = await Conversation.findOne({ participantKey });
        else throw error;
      }
    }
    res.status(201).json({ success: true, data: { conversation } });
  } catch { res.status(500).json({ success: false, message: 'Unable to start conversation.' }); }
};

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversations = await Conversation.find({ participantIds: req.user!._id }).sort({ lastMessageAt: -1, createdAt: -1 });
    const rows = await Promise.all(conversations.map(async (conversation) => {
      const otherId = conversation.participantIds.find((id) => !id.equals(req.user!._id));
      const [otherParticipant, lastMessage, unreadCount] = await Promise.all([
        otherId ? User.findById(otherId).select('fullName role providerProfile.organizationName providerProfile.organizationType') : null,
        Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 }),
        Message.countDocuments({ conversationId: conversation._id, senderId: { $ne: req.user!._id }, readAt: { $exists: false } }),
      ]);
      return { ...conversation.toObject(), otherParticipant, lastMessagePreview: lastMessage?.content || '', unreadCount };
    }));
    res.json({ success: true, data: { conversations: rows } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load conversations.' }); }
};

export const listConversationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid conversation ID.' }); return; }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !isParticipant(conversation, req.user!._id)) { res.status(404).json({ success: false, message: 'Conversation not found.' }); return; }
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).skip((page - 1) * 40).limit(40);
    res.json({ success: true, data: { messages: messages.reverse(), page } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load messages.' }); }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!mongoose.isValidObjectId(req.params.id) || !content || content.length > 2000) { res.status(400).json({ success: false, message: 'Message content must be between 1 and 2000 characters.' }); return; }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !isParticipant(conversation, req.user!._id)) { res.status(404).json({ success: false, message: 'Conversation not found.' }); return; }
    const message = await Message.create({ conversationId: conversation._id, senderId: req.user!._id, content });
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();
    res.status(201).json({ success: true, data: { message } });
  } catch { res.status(500).json({ success: false, message: 'Unable to send message.' }); }
};

export const markConversationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid conversation ID.' }); return; }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !isParticipant(conversation, req.user!._id)) { res.status(404).json({ success: false, message: 'Conversation not found.' }); return; }
    await Message.updateMany({ conversationId: conversation._id, senderId: { $ne: req.user!._id }, readAt: { $exists: false } }, { readAt: new Date() });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to mark messages as read.' }); }
};

export const listMentors = async (_req: Request, res: Response): Promise<void> => {
  try {
    const people = await User.find({ role: 'provider', accountStatus: 'active', 'providerProfile.verified': true, 'providerProfile.organizationType': { $in: ['faculty', 'alumni'] } })
      .select('fullName providerProfile.organizationName providerProfile.organizationType providerProfile.description');
    res.json({ success: true, data: { people } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load community directory.' }); }
};
