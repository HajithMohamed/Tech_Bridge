import { type ClientSession, Types } from 'mongoose';
import NotificationOutbox from '../models/NotificationOutbox';

export interface PendingNotification { ownerId: string; kind: 'campaign'; title: string; body: string; href: string; dedupeKey: string }
/** Persist a pending notice in the caller's transaction; never imply delivery. */
export async function enqueueNotification(notice: PendingNotification, session: ClientSession): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(notice.ownerId) || notice.kind !== 'campaign' || !['/my-promotion-requests', '/provider/promotion-requests'].includes(notice.href) || !notice.title.trim() || notice.title.length > 100 || !notice.body.trim() || notice.body.length > 500 || !notice.dedupeKey.trim() || notice.dedupeKey.length > 200) throw new Error('Invalid pending notification.');
  const ownerId = new Types.ObjectId(notice.ownerId);
  await NotificationOutbox.updateOne({ ownerId, dedupeKey: notice.dedupeKey }, { $setOnInsert: { ...notice, ownerId, status: 'pending' } }, { upsert: true, session, runValidators: true });
}
