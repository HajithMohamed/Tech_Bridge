import mongoose from 'mongoose';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import ResourceRequest from '../models/ResourceRequest';
import { Mentorship } from '../models/Mentorship';
import { SavedOpportunity } from '../models/OpportunityActivity';
import { NotificationProducer } from '../models/Notification';
import { enqueueNotification } from './notifications';
import { notificationTemplate, NotificationError } from './notificationPolicy';
import { notificationTransactions } from './notificationDelivery';
import { enqueueCampusEventWork } from './campusEventNotifications';

/** Bounded rotating scans: progress over source rows, including non-due rows. */
export async function enqueueNotificationReminders(limit = 100, now = new Date()) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) throw new NotificationError(400, 'Invalid reminder scan.');
  const end = new Date(now.getTime() + 86_400_000);
  const scholarships = await mongoose.connection.transaction(async session => {
    const cursor = await NotificationProducer.findOneAndUpdate({ key: 'scholarship-reminders' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    let applications = await Application.find({ status: { $in: ['applied', 'reviewed', 'waitlisted'] }, ...(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}) }).select('studentId opportunityId').sort({ _id: 1 }).limit(limit).session(session);
    if (!applications.length && cursor.afterId) applications = await Application.find({ status: { $in: ['applied', 'reviewed', 'waitlisted'] } }).select('studentId opportunityId').sort({ _id: 1 }).limit(limit).session(session);
    const opportunities = await Opportunity.find({ _id: { $in: applications.map(row => row.opportunityId) }, type: 'scholarship', status: 'open', scholarshipWithdrawnByAdmin: { $ne: true }, applicationDeadline: { $gt: now, $lte: end } }).select('applicationDeadline').session(session);
    const byId = new Map(opportunities.map(row => [String(row._id), row])); let considered = 0;
    for (const row of applications) {
      const opportunity = byId.get(String(row.opportunityId)); if (!opportunity) continue; considered++;
      const safe = notificationTemplate('scholarship', 'student', 'deadline');
      await enqueueNotification({ ownerId: String(row.studentId), kind: 'scholarship', action: 'deadline', ...safe, sourceType: 'scholarship', sourceId: row._id, scheduledFor: opportunity.applicationDeadline, dedupeKey: `scholarship-deadline:${row._id}:${opportunity.applicationDeadline.toISOString()}` }, session);
    }
    await NotificationProducer.updateOne({ _id: cursor._id }, applications.length ? { $set: { afterId: applications[applications.length - 1]._id } } : { $unset: { afterId: '' } }, { session });
    return { scanned: applications.length, considered };
  }, notificationTransactions);
  const resources = await mongoose.connection.transaction(async session => {
    const cursor = await NotificationProducer.findOneAndUpdate({ key: 'resource-reminders' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    let requests = await ResourceRequest.find({ status: 'accepted', ...(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}) }).select('studentId allocation').sort({ _id: 1 }).limit(limit).session(session); let considered = 0;
    if (!requests.length && cursor.afterId) requests = await ResourceRequest.find({ status: 'accepted' }).select('studentId allocation').sort({ _id: 1 }).limit(limit).session(session);
    for (const row of requests) {
      const due = row.allocation?.dueAt; if (!row.allocation?.returnRequired || !due || due > end) continue; considered++;
      const action = due < now ? 'overdue' : 'due'; const safe = notificationTemplate('resource', 'student', action);
      await enqueueNotification({ ownerId: String(row.studentId), kind: 'resource', action, ...safe, sourceType: 'resource', sourceId: row._id, scheduledFor: due, dedupeKey: `resource-reminder:${row._id}:${due.toISOString()}:${now.toISOString().slice(0, 10)}` }, session);
    }
    await NotificationProducer.updateOne({ _id: cursor._id }, requests.length ? { $set: { afterId: requests[requests.length - 1]._id } } : { $unset: { afterId: '' } }, { session });
    return { scanned: requests.length, considered };
  }, notificationTransactions);
  const mentorships = await mongoose.connection.transaction(async session => {
    const cursor = await NotificationProducer.findOneAndUpdate({ key: 'mentorship-reminders' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    let rows = await Mentorship.find({ status: 'scheduled', ...(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}) }).select('mentorId studentId appointment').sort({ _id: 1 }).limit(limit).session(session);
    if (!rows.length && cursor.afterId) rows = await Mentorship.find({ status: 'scheduled' }).select('mentorId studentId appointment').sort({ _id: 1 }).limit(limit).session(session);
    let considered = 0;
    for (const row of rows) {
      const startAt = row.appointment?.startAt; if (!startAt || startAt <= now || startAt > end) continue; considered++;
      const safe = notificationTemplate('mentorship', 'student', 'due');
      for (const ownerId of [row.studentId, row.mentorId]) await enqueueNotification({ ownerId: String(ownerId), kind: 'mentorship', action: 'due', ...safe, sourceType: 'mentorship', sourceId: row._id, scheduledFor: startAt, dedupeKey: `mentorship-reminder:${row._id}:${startAt.toISOString()}` }, session);
    }
    await NotificationProducer.updateOne({ _id: cursor._id }, rows.length ? { $set: { afterId: rows[rows.length - 1]._id } } : { $unset: { afterId: '' } }, { session });
    return { scanned: rows.length, considered };
  }, notificationTransactions);
  const savedOpportunities = await mongoose.connection.transaction(async session => {
    const cursor = await NotificationProducer.findOneAndUpdate({ key: 'saved-opportunity-reminders' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    let rows = await SavedOpportunity.find(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}).sort({ _id: 1 }).limit(limit).session(session);
    if (!rows.length && cursor.afterId) rows = await SavedOpportunity.find({}).sort({ _id: 1 }).limit(limit).session(session);
    const listings = await Opportunity.find({ _id: { $in: rows.map(row => row.opportunityId) }, status: 'open', scholarshipWithdrawnByAdmin: { $ne: true }, opportunityWithdrawnByAdmin: { $ne: true }, applicationDeadline: { $gt: now, $lte: end } }).select('applicationDeadline').session(session);
    const byId = new Map(listings.map(row => [String(row._id), row])); let considered = 0;
    for (const row of rows) {
      const listing = byId.get(String(row.opportunityId)); if (!listing) continue; considered++;
      const safe = notificationTemplate('application', 'student', 'deadline', 'opportunity');
      await enqueueNotification({ ownerId: String(row.studentId), kind: 'application', action: 'deadline', ...safe, sourceType: 'opportunity', sourceId: row._id, scheduledFor: listing.applicationDeadline, dedupeKey: `saved-deadline:${row._id}:${listing.applicationDeadline.toISOString()}` }, session);
    }
    await NotificationProducer.updateOne({ _id: cursor._id }, rows.length ? { $set: { afterId: rows[rows.length - 1]._id } } : { $unset: { afterId: '' } }, { session });
    return { scanned: rows.length, considered };
  }, notificationTransactions);
  const campusEvents = await enqueueCampusEventWork(limit, now);
  return { scholarships, resources, mentorships, savedOpportunities, campusEvents };
}
