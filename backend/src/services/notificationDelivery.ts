import { randomUUID } from 'node:crypto';
import mongoose, { type ClientSession, Types } from 'mongoose';
import NotificationOutbox from '../models/NotificationOutbox';
import Notification, { NotificationPreferences } from '../models/Notification';
import User from '../models/User';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import MessagingSettings from '../models/MessagingSettings';
import { CommunityClaim } from '../models/CommunityClaim';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import ResourceRequest from '../models/ResourceRequest';
import Resource from '../models/Resource';
import { communityPair } from './communityMessaging';
import { communityVisible } from './communityPolicy';
import { notificationKind, notificationRetry, notificationTemplate, type NotificationAction, NotificationError } from './notificationPolicy';
import { mentorshipReminderAvailable } from './mentorship';

export const notificationTransactions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
async function messageAvailable(sourceId: Types.ObjectId | undefined, ownerId: Types.ObjectId, session: ClientSession) {
  if (!sourceId) return false;
  const message = await Message.findOne({ _id: sourceId, readAt: { $exists: false } }).select('conversationId senderId').session(session);
  if (!message || message.senderId.equals(ownerId)) return false;
  const conversation = await Conversation.findOne({ _id: message.conversationId, participantIds: ownerId }).session(session);
  if (!conversation || !conversation.participantIds.some(id => id.equals(message.senderId))) return false;
  const users = await User.find({ _id: { $in: conversation.participantIds } }).session(session);
  if (users.length !== 2 || users.some(user => user.accountStatus === 'suspended' || (user.role === 'provider' && (user.providerProfile?.verified !== true || user.providerProfile.verificationStatus !== 'VERIFIED')))) return false;
  const senderLock = await User.updateOne({ _id: message.senderId }, { $inc: { __v: 1 } }, { session, timestamps: false });
  if (!senderLock.matchedCount) return false;
  const settings = await MessagingSettings.find({ ownerId: { $in: conversation.participantIds } }).session(session);
  if (settings.some(row => row.blockedIds.some(id => conversation.participantIds.some(member => member.equals(id))))) return false;
  const recipient = settings.find(row => row.ownerId.equals(ownerId));
  if (recipient?.notifications === false || recipient?.acceptsMessages === false) return false;
  if (communityPair(users[0], users[1])) {
    const provider = users.find(user => user.role === 'provider');
    const claim = await CommunityClaim.findOne({ providerId: provider!._id }).session(session);
    if (!communityVisible(provider!, claim) || !claim?.profile.acceptsStudentMessages) return false;
  }
  return true;
}
export async function claimNotification(now = new Date()) {
  const token = randomUUID();
  return NotificationOutbox.findOneAndUpdate({ $and: [
    { $or: [{ status: 'pending', $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] }, { status: 'processing', leaseUntil: { $lte: now } }] },
    { $or: [{ attempts: { $exists: false } }, { attempts: { $lt: 5 } }] },
  ] }, { $set: { status: 'processing', leaseToken: token, leaseUntil: new Date(now.getTime() + 60_000) }, $inc: { attempts: 1 }, $unset: { outcome: '' } }, { new: true, sort: { createdAt: 1, _id: 1 }, runValidators: true }).select('+leaseToken');
}
export async function deliverClaimedNotification(id: Types.ObjectId, token: string, now = new Date()) {
  return mongoose.connection.transaction(async session => {
    const job = await NotificationOutbox.findOne({ _id: id, status: 'processing', leaseToken: token }).session(session);
    if (!job) throw new NotificationError(409, 'Notification lease changed.');
    const kind = notificationKind(job.kind); let action = (job.action ?? 'updated') as NotificationAction;
    let outcome: 'delivered' | 'preferences' | 'recipient' | 'message_unavailable' | 'stale_source' = 'delivered';
    const recipient = await User.findOneAndUpdate({ _id: job.ownerId, accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!recipient || (recipient.role === 'provider' && kind !== 'verification' && (recipient.providerProfile?.verified !== true || recipient.providerProfile.verificationStatus !== 'VERIFIED'))) outcome = 'recipient';
    const preferences = await NotificationPreferences.findOne({ ownerId: job.ownerId }).session(session);
    const categories = preferences?.toObject().categories as Record<string, boolean> | undefined;
    if (outcome === 'delivered' && (preferences?.inApp === false || categories?.[kind] === false)) outcome = 'preferences';
    if (outcome === 'delivered' && kind === 'message' && !await messageAvailable(job.sourceId ?? undefined, job.ownerId, session)) outcome = 'message_unavailable';
    if (outcome === 'delivered' && kind === 'mentorship' && action === 'due' && !await mentorshipReminderAvailable(job.sourceId ?? undefined, job.ownerId, job.scheduledFor ?? undefined, now, session)) outcome = 'stale_source';
    if (outcome === 'delivered' && kind === 'scholarship' && action === 'deadline') {
      const application = await Application.findOne({ _id: job.sourceId, studentId: job.ownerId, status: { $in: ['applied', 'reviewed', 'waitlisted'] } }).session(session);
      const opportunity = application ? await Opportunity.findOne({ _id: application.opportunityId, type: 'scholarship', status: 'open', scholarshipWithdrawnByAdmin: { $ne: true } }).session(session) : null;
      if (!opportunity || !job.scheduledFor || opportunity.applicationDeadline.getTime() !== job.scheduledFor.getTime() || opportunity.applicationDeadline <= now || opportunity.applicationDeadline.getTime() > now.getTime() + 86_400_000) outcome = 'stale_source';
    }
    if (outcome === 'delivered' && kind === 'resource' && ['due', 'overdue'].includes(action)) {
      const allocation = await ResourceRequest.findOne({ _id: job.sourceId, studentId: job.ownerId, status: 'accepted', 'allocation.returnRequired': true }).session(session);
      if (!allocation?.allocation?.dueAt || !job.scheduledFor || allocation.allocation.dueAt.getTime() !== job.scheduledFor.getTime() || allocation.allocation.dueAt.getTime() > now.getTime() + 86_400_000) outcome = 'stale_source';
      else if (!await Resource.exists({ _id: allocation.resourceId, listedBy: allocation.providerId, category: allocation.resourceCategory, accessType: allocation.requestedAccessType }).session(session)) outcome = 'stale_source';
      else action = allocation.allocation.dueAt < now ? 'overdue' : 'due';
    }
    if (outcome === 'delivered') {
      const safe = notificationTemplate(kind, recipient!.role, action, job.sourceType ?? undefined);
      await Notification.updateOne({ ownerId: job.ownerId, dedupeKey: job.dedupeKey }, { $setOnInsert: { ownerId: job.ownerId, dedupeKey: job.dedupeKey, kind, action, ...safe, ...(job.sourceType ? { sourceType: job.sourceType } : {}), ...(job.sourceId ? { sourceId: job.sourceId } : {}), occurredAt: job.createdAt } }, { upsert: true, runValidators: true, session });
    }
    const saved = await NotificationOutbox.updateOne({ _id: id, status: 'processing', leaseToken: token }, { $set: { status: outcome === 'delivered' ? 'delivered' : 'suppressed', outcome, processedAt: now, ...(outcome === 'delivered' ? { deliveredAt: now } : {}) }, $unset: { leaseToken: '', leaseUntil: '', nextAttemptAt: '', ...(outcome === 'delivered' ? {} : { deliveredAt: '' }) } }, { session });
    if (saved.modifiedCount !== 1) throw new NotificationError(409, 'Notification lease changed.');
    return outcome;
  }, notificationTransactions);
}
export async function runNotificationBatch(limit = 20, now = new Date()) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) throw new NotificationError(400, 'Invalid notification batch.');
  await NotificationOutbox.updateMany({ status: 'processing', leaseUntil: { $lte: now }, attempts: { $gte: 5 } }, { $set: { status: 'failed', outcome: 'lease_exhausted' }, $unset: { leaseToken: '', leaseUntil: '' } });
  const results = { claimed: 0, delivered: 0, suppressed: 0, retried: 0, failed: 0 };
  for (let index = 0; index < limit; index++) {
    const job = await claimNotification(now); if (!job) break; results.claimed++;
    try { const outcome = await deliverClaimedNotification(job._id, job.leaseToken!, now); if (outcome === 'delivered') results.delivered++; else results.suppressed++; }
    catch (error) {
      const permanent = (error instanceof NotificationError && error.statusCode === 400) || error instanceof mongoose.Error.ValidationError;
      const failed = permanent || job.attempts >= 5;
      await NotificationOutbox.updateOne({ _id: job._id, status: 'processing', leaseToken: job.leaseToken }, { $set: { status: failed ? 'failed' : 'pending', outcome: permanent ? 'invalid_notice' : 'delivery_failed', ...(failed ? {} : { nextAttemptAt: notificationRetry(job.attempts, now) }) }, $unset: { leaseToken: '', leaseUntil: '' } });
      if (failed) results.failed++; else results.retried++;
    }
  }
  return results;
}
