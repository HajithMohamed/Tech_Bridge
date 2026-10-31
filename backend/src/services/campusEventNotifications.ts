import mongoose, { type ClientSession, Types } from 'mongoose';
import User from '../models/User';
import { CampusEvent, CampusOrganizer, EventRegistration } from '../models/CampusEvent';
import { NotificationProducer } from '../models/Notification';
import { campusEventTransactions } from './campusEvents';
import { eventPublicationActive, organizerEligible } from './campusEventPolicy';
import { enqueueNotification } from './notifications';
import { NotificationError, notificationTemplate } from './notificationPolicy';

/** A rotating, bounded registration scan also fans out event/authority changes. */
export async function enqueueCampusEventWork(limit = 100, now = new Date()) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) throw new NotificationError(400, 'Invalid event reminder scan.');
  return mongoose.connection.transaction(async session => {
    const cursor = await NotificationProducer.findOneAndUpdate({ key: 'campus-event-registrations' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    const fields = '+lastEventNoticeRevision +lastGrantNoticeRevision';
    let rows = await EventRegistration.find({ status: 'registered', ...(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}) }).select(fields).sort({ _id: 1 }).limit(limit).session(session);
    if (!rows.length && cursor.afterId) rows = await EventRegistration.find({ status: 'registered' }).select(fields).sort({ _id: 1 }).limit(limit).session(session);
    const events = await CampusEvent.find({ _id: { $in: rows.map(row => row.eventId) } }).session(session);
    const grants = await CampusOrganizer.find({ ownerId: { $in: events.map(event => event.organizerId) } }).session(session);
    const byEvent = new Map(events.map(event => [String(event._id), event])); const byGrant = new Map(grants.map(grant => [String(grant.ownerId), grant]));
    let considered = 0; let updates = 0;
    for (const row of rows) {
      const event = byEvent.get(String(row.eventId)); if (!event) continue;
      const grantRevision = byGrant.get(String(event.organizerId))?.revision ?? 0;
      if (row.lastEventNoticeRevision !== event.noticeRevision || row.lastGrantNoticeRevision !== grantRevision) {
        const safe = notificationTemplate('event', 'student');
        await enqueueNotification({ ownerId: String(row.studentId), kind: 'event', action: 'updated', ...safe, sourceType: 'event', sourceId: row._id, dedupeKey: `event-update:${row._id}:${event.noticeRevision}:${grantRevision}` }, session);
        // Delivery progress is not a user action and must not advance business revisions.
        await EventRegistration.updateOne({ _id: row._id }, { $set: { lastEventNoticeRevision: event.noticeRevision, lastGrantNoticeRevision: grantRevision } }, { session, timestamps: false }); updates++;
      }
      if (event.status !== 'published' || event.startsAt <= now || event.startsAt.getTime() > now.getTime() + 86400000) continue;
      const safe = notificationTemplate('event', 'student', 'due'); considered++;
      await enqueueNotification({ ownerId: String(row.studentId), kind: 'event', action: 'due', ...safe, sourceType: 'event', sourceId: row._id, scheduledFor: event.startsAt, sourceRevision: event.grantRevision, dedupeKey: `event-reminder:${row._id}:${event.startsAt.toISOString()}:${event.grantRevision}` }, session);
    }
    await NotificationProducer.updateOne({ _id: cursor._id }, rows.length ? { $set: { afterId: rows[rows.length - 1]._id } } : { $unset: { afterId: '' } }, { session });
    return { scanned: rows.length, considered, updates };
  }, campusEventTransactions);
}

type EventNotice = { ownerId: Types.ObjectId; sourceType?: string | null; sourceId?: Types.ObjectId | null; action?: string | null; scheduledFor?: Date | null; sourceRevision?: number | null };
/** Reauthorize the source at delivery, including exact schedule and approval version. */
export async function campusEventNoticeAvailable(job: EventNotice, now: Date, session: ClientSession) {
  if (!job.sourceId) return false;
  const recipient = await User.findById(job.ownerId).session(session);
  if (!recipient || recipient.accountStatus === 'suspended' || (recipient.requiresEmailVerification && !recipient.emailVerifiedAt)) return false;
  if (job.sourceType === 'event_organizer') return ['student', 'provider'].includes(recipient.role) && Boolean(await CampusOrganizer.exists({ _id: job.sourceId, ownerId: job.ownerId }).session(session));
  if (job.sourceType !== 'event') return false;
  const row = await EventRegistration.findById(job.sourceId).session(session); if (!row) return false;
  const event = await CampusEvent.findById(row.eventId).session(session); if (!event) return false;
  if (job.action !== 'due' && row.studentId.equals(job.ownerId)) return recipient.role === 'student';
  if (job.action === 'due' && (!row.studentId.equals(job.ownerId) || recipient.role !== 'student' || row.status !== 'registered' || event.status !== 'published' || !job.scheduledFor || job.scheduledFor.getTime() !== event.startsAt.getTime() || job.sourceRevision !== event.grantRevision || event.startsAt <= now || event.startsAt.getTime() > now.getTime() + 86400000)) return false;
  if (job.action !== 'due' && !event.organizerId.equals(job.ownerId)) return false;
  const owner = await User.findOneAndUpdate({ _id: event.organizerId }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
  const grant = await CampusOrganizer.findOne({ ownerId: event.organizerId }).select('+identity').session(session);
  return job.action === 'due' ? eventPublicationActive(event, owner, grant) : organizerEligible(owner, grant) && grant!.institution === event.institution;
}
