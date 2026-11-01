import mongoose, { Types } from 'mongoose';
import Report from '../models/Report';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import MessageReviewAccess from '../models/MessageReviewAccess';
import AuditLog from '../models/AuditLog';
import { AdminActionError } from './adminUsers';
import { lockMessagingUser, messagingTransactionOptions } from './messaging';

export async function reportMessage(reporterId: Types.ObjectId, targetId: Types.ObjectId, reason: string) {
  return mongoose.connection.transaction(async (session) => {
    await lockMessagingUser(reporterId, session);
    const message = await Message.findById(targetId).session(session);
    if (!message || message.senderId.equals(reporterId) || !await Conversation.exists({ _id: message.conversationId, participantIds: reporterId }).session(session)) throw new AdminActionError(404, 'Message not found.');
    const count = await Report.countDocuments({ reporterId, targetType: 'message', createdAt: { $gt: new Date(Date.now() - 86400_000) } }).session(session);
    if (count >= 10) throw new AdminActionError(429, 'Daily message report limit reached.');
    const [report] = await Report.create([{ reporterId, targetType: 'message', targetId, reason }], { session });
    return report;
  }, messagingTransactionOptions);
}
export async function reviewReportedMessage(actorId: Types.ObjectId, reportId: Types.ObjectId, reason: string) {
  return mongoose.connection.transaction(async (session) => {
    const actor = await lockMessagingUser(actorId, session);
    if (actor.role !== 'admin') throw new AdminActionError(403, 'Administrator access required.');
    const report = await Report.findOneAndUpdate({ _id: reportId, targetType: 'message', status: 'open' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!report) throw new AdminActionError(404, 'Open message complaint not found.');
    if (report.reporterId.equals(actorId)) throw new AdminActionError(403, 'Another administrator must review your complaint.');
    const message = await Message.findById(report.targetId).session(session);
    if (!message || message.senderId.equals(report.reporterId) || !await Conversation.exists({ _id: message.conversationId, participantIds: report.reporterId }).session(session)) throw new AdminActionError(404, 'Complaint evidence unavailable.');
    if (message.senderId.equals(actorId)) throw new AdminActionError(403, 'Another administrator must review this complaint.');
    await MessageReviewAccess.create([{ actorId, reportId, messageId: message._id, reason }], { session });
    await AuditLog.create([{ adminId: actorId, action: 'reported_message_accessed', targetType: 'user', targetId: report.reporterId, reason: `Complaint ${reportId}: ${reason}` }], { session });
    // Return only the reported message. No neighboring content, participant
    // contact details or conversation identifier is available to the reviewer.
    return { _id: message._id, senderId: message.senderId, content: message.content, createdAt: message.createdAt };
  }, messagingTransactionOptions);
}
export async function resolveMessageReport(actorId: Types.ObjectId, reportId: Types.ObjectId, status: 'reviewed' | 'dismissed', reason: string) {
  return mongoose.connection.transaction(async (session) => {
    const actor = await lockMessagingUser(actorId, session);
    if (actor.role !== 'admin') throw new AdminActionError(403, 'Administrator access required.');
    const report = await Report.findOne({ _id: reportId, targetType: 'message', status: 'open' }).session(session);
    if (!report) throw new AdminActionError(409, 'This complaint is no longer open.');
    if (report.reporterId.equals(actorId)) throw new AdminActionError(403, 'Another administrator must review your complaint.');
    const target = await Message.findById(report.targetId).session(session);
    if (target?.senderId.equals(actorId)) throw new AdminActionError(403, 'Another administrator must review this complaint.');
    if (status === 'reviewed' && !await MessageReviewAccess.exists({ reportId, actorId }).session(session)) throw new AdminActionError(409, 'Review the reported message before resolving this complaint.');
    report.status = status; report.resolutionNote = reason; await report.save({ session });
    await AuditLog.create([{ adminId: actorId, action: 'message_report_resolved', targetType: 'user', targetId: report.reporterId, reason: `Complaint ${reportId}: ${reason}` }], { session });
    return report;
  }, messagingTransactionOptions);
}
