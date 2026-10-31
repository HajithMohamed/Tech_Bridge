import { type ClientSession, Types } from 'mongoose';
import NotificationOutbox from '../models/NotificationOutbox';
import { notificationActions, notificationHrefs, notificationKind, notificationTemplate, type NotificationAction, type NotificationKind } from './notificationPolicy';

export interface PendingNotification { ownerId: string; kind: NotificationKind; title: string; body: string; href: string; dedupeKey: string; action?: NotificationAction; sourceType?: 'campaign' | 'message' | 'application' | 'scholarship' | 'resource' | 'verification' | 'community' | 'mentorship' | 'opportunity'; sourceId?: Types.ObjectId; scheduledFor?: Date }
/** Persist a pending notice in the caller's transaction; never imply delivery. */
export async function enqueueNotification(notice: PendingNotification, session: ClientSession): Promise<void> {
  notificationKind(notice.kind);
  if (!/^[a-f\d]{24}$/i.test(notice.ownerId) || !notificationHrefs.includes(notice.href as typeof notificationHrefs[number]) || !notice.title.trim() || notice.title.length > 100 || !notice.body.trim() || notice.body.length > 500 || !notice.dedupeKey.trim() || notice.dedupeKey.length > 200 || (notice.action !== undefined && !notificationActions.includes(notice.action))) throw new Error('Invalid pending notification.');
  const ownerId = new Types.ObjectId(notice.ownerId);
  await NotificationOutbox.updateOne({ ownerId, dedupeKey: notice.dedupeKey }, { $setOnInsert: { ...notice, ownerId, status: 'pending' } }, { upsert: true, session, runValidators: true });
}

/** Internal domain-event adapter; recipients are supplied by authorized services. */
export async function enqueueDomainNotification(kind: NotificationKind, ownerId: Types.ObjectId, dedupeKey: string, sourceId: Types.ObjectId, session: ClientSession, action: NotificationAction = 'updated', sourceType: PendingNotification['sourceType'] = kind) {
  const safe = notificationTemplate(kind, 'student', action, sourceType);
  await enqueueNotification({ ownerId: String(ownerId), kind, ...safe, action, sourceId, sourceType, dedupeKey }, session);
}
