"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMentors = exports.markConversationRead = exports.sendMessage = exports.listConversationMessages = exports.listConversations = exports.startConversation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Application_1 = __importDefault(require("../models/Application"));
const Conversation_1 = __importDefault(require("../models/Conversation"));
const Message_1 = __importDefault(require("../models/Message"));
const PromotionRequest_1 = __importDefault(require("../models/PromotionRequest"));
const ResourceRequest_1 = __importDefault(require("../models/ResourceRequest"));
const User_1 = __importDefault(require("../models/User"));
const keyFor = (first, second) => [first.toString(), second.toString()].sort().join(':');
const isParticipant = (conversation, userId) => conversation.participantIds.some((id) => id.equals(userId));
const mayStartConversation = async (senderId, recipientId) => {
    const [sender, recipient] = await Promise.all([User_1.default.findById(senderId), User_1.default.findById(recipientId)]);
    if (!sender || !recipient)
        return false;
    if (sender.role === 'admin')
        return true;
    if (recipient.accountStatus !== 'active')
        return false;
    if (sender.role === 'student' && recipient.role === 'provider') {
        if (recipient.providerProfile?.verified && ['alumni', 'faculty'].includes(recipient.providerProfile.organizationType))
            return true;
        const [application, request, promotionRequest] = await Promise.all([
            Application_1.default.exists({ studentId: senderId, providerId: recipientId, status: { $ne: 'rejected' } }),
            ResourceRequest_1.default.exists({ studentId: senderId, providerId: recipientId, status: { $ne: 'rejected' } }),
            PromotionRequest_1.default.exists({ studentId: senderId, providerId: recipientId, status: { $in: ['accepted', 'completed'] } }),
        ]);
        return Boolean(application || request || promotionRequest);
    }
    if (sender.role === 'provider' && recipient.role === 'student') {
        const [application, request, promotionRequest] = await Promise.all([
            Application_1.default.exists({ studentId: recipientId, providerId: senderId, status: { $ne: 'rejected' } }),
            ResourceRequest_1.default.exists({ studentId: recipientId, providerId: senderId, status: { $ne: 'rejected' } }),
            PromotionRequest_1.default.exists({ studentId: recipientId, providerId: senderId, status: { $in: ['accepted', 'completed'] } }),
        ]);
        return Boolean(application || request || promotionRequest);
    }
    return false;
};
const startConversation = async (req, res) => {
    try {
        const { recipientId } = req.body;
        if (!mongoose_1.default.isValidObjectId(recipientId) || req.user._id.toString() === recipientId) {
            res.status(400).json({ success: false, message: 'Choose another valid user.' });
            return;
        }
        const allowed = await mayStartConversation(req.user._id, new mongoose_1.default.Types.ObjectId(recipientId));
        if (!allowed) {
            res.status(403).json({ success: false, message: 'You can only message verified faculty/alumni or a provider/student connected through an application, resource request, or accepted promotion request.' });
            return;
        }
        const participantIds = [req.user._id, new mongoose_1.default.Types.ObjectId(recipientId)];
        const participantKey = keyFor(participantIds[0], participantIds[1]);
        let conversation = await Conversation_1.default.findOne({ participantKey });
        if (!conversation) {
            try {
                conversation = await Conversation_1.default.create({ participantIds, participantKey });
            }
            catch (error) {
                if (error.code === 11000)
                    conversation = await Conversation_1.default.findOne({ participantKey });
                else
                    throw error;
            }
        }
        res.status(201).json({ success: true, data: { conversation } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to start conversation.' });
    }
};
exports.startConversation = startConversation;
const listConversations = async (req, res) => {
    try {
        const conversations = await Conversation_1.default.find({ participantIds: req.user._id }).sort({ lastMessageAt: -1, createdAt: -1 });
        const rows = await Promise.all(conversations.map(async (conversation) => {
            const otherId = conversation.participantIds.find((id) => !id.equals(req.user._id));
            const [otherParticipant, lastMessage, unreadCount] = await Promise.all([
                otherId ? User_1.default.findById(otherId).select('fullName role providerProfile.organizationName providerProfile.organizationType') : null,
                Message_1.default.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 }),
                Message_1.default.countDocuments({ conversationId: conversation._id, senderId: { $ne: req.user._id }, readAt: { $exists: false } }),
            ]);
            return { ...conversation.toObject(), otherParticipant, lastMessagePreview: lastMessage?.content || '', unreadCount };
        }));
        res.json({ success: true, data: { conversations: rows } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load conversations.' });
    }
};
exports.listConversations = listConversations;
const listConversationMessages = async (req, res) => {
    try {
        if (!mongoose_1.default.isValidObjectId(req.params.id)) {
            res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
            return;
        }
        const conversation = await Conversation_1.default.findById(req.params.id);
        if (!conversation || !isParticipant(conversation, req.user._id)) {
            res.status(404).json({ success: false, message: 'Conversation not found.' });
            return;
        }
        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const messages = await Message_1.default.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).skip((page - 1) * 40).limit(40);
        res.json({ success: true, data: { messages: messages.reverse(), page } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load messages.' });
    }
};
exports.listConversationMessages = listConversationMessages;
const sendMessage = async (req, res) => {
    try {
        const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
        if (!mongoose_1.default.isValidObjectId(req.params.id) || !content || content.length > 2000) {
            res.status(400).json({ success: false, message: 'Message content must be between 1 and 2000 characters.' });
            return;
        }
        const conversation = await Conversation_1.default.findById(req.params.id);
        if (!conversation || !isParticipant(conversation, req.user._id)) {
            res.status(404).json({ success: false, message: 'Conversation not found.' });
            return;
        }
        const message = await Message_1.default.create({ conversationId: conversation._id, senderId: req.user._id, content });
        conversation.lastMessageAt = message.createdAt;
        await conversation.save();
        res.status(201).json({ success: true, data: { message } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to send message.' });
    }
};
exports.sendMessage = sendMessage;
const markConversationRead = async (req, res) => {
    try {
        if (!mongoose_1.default.isValidObjectId(req.params.id)) {
            res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
            return;
        }
        const conversation = await Conversation_1.default.findById(req.params.id);
        if (!conversation || !isParticipant(conversation, req.user._id)) {
            res.status(404).json({ success: false, message: 'Conversation not found.' });
            return;
        }
        await Message_1.default.updateMany({ conversationId: conversation._id, senderId: { $ne: req.user._id }, readAt: { $exists: false } }, { readAt: new Date() });
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to mark messages as read.' });
    }
};
exports.markConversationRead = markConversationRead;
const listMentors = async (_req, res) => {
    try {
        const people = await User_1.default.find({ role: 'provider', accountStatus: 'active', 'providerProfile.verified': true, 'providerProfile.organizationType': { $in: ['faculty', 'alumni'] } })
            .select('fullName providerProfile.organizationName providerProfile.organizationType providerProfile.description');
        res.json({ success: true, data: { people } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load community directory.' });
    }
};
exports.listMentors = listMentors;
//# sourceMappingURL=messageController.js.map