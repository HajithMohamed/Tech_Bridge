import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Notification, { NotificationPreferences } from '../models/Notification';
import User from '../models/User';
import { defaultNotificationPreferences, notificationId, notificationKind, notificationPage, notificationPreferencesInput, NotificationError } from '../services/notificationPolicy';

const privateProjection = '_id kind action title body href sourceType sourceId occurredAt createdAt readAt';
const visible = (req: Request) => ({ ownerId: req.user!._id, ...(req.notificationVerificationOnly || (req.user!.role === 'provider' && (req.user!.providerProfile?.verified !== true || req.user!.providerProfile.verificationStatus !== 'VERIFIED')) ? { kind: 'verification' } : {}) });
function failure(res: Response, error: unknown) {
  if (error instanceof NotificationError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  res.status(503).json({ success: false, message: 'Notification services are temporarily unavailable.' });
}
export const listNotifications = async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).some(key => !['page', 'limit', 'kind', 'unread'].includes(key))) throw new NotificationError(400, 'Unsupported notification filter.');
    const page = notificationPage(req.query.page); const limit = notificationPage(req.query.limit, 20, 100);
    const filter: Record<string, unknown> = visible(req);
    if (req.query.kind !== undefined) { const kind = notificationKind(req.query.kind); if (filter.kind && filter.kind !== kind) throw new NotificationError(403, 'Complete provider verification before accessing that category.'); filter.kind = kind; }
    if (req.query.unread !== undefined) { if (!['true', 'false'].includes(req.query.unread as string)) throw new NotificationError(400, 'Unread filter must be true or false.'); filter.readAt = { $exists: req.query.unread === 'false' }; }
    const [notifications, total, unread] = await Promise.all([Notification.find(filter).select(privateProjection).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Notification.countDocuments(filter), Notification.countDocuments({ ...visible(req), readAt: { $exists: false } })]);
    res.json({ success: true, data: { notifications, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), unread } });
  } catch (error) { failure(res, error); }
};
export const unreadNotifications = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { unread: await Notification.countDocuments({ ...visible(req), readAt: { $exists: false } }) } }); } catch (error) { failure(res, error); }
};
export const setNotificationRead = async (req: Request, res: Response) => {
  try {
    const id = notificationId(req.params.id); const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.read !== 'boolean') throw new NotificationError(400, 'Provide only a read boolean.');
    const filter = { _id: id, ...visible(req) };
    let row;
    if (body.read) {
      row = await Notification.findOneAndUpdate({ ...filter, readAt: { $exists: false } }, { $set: { readAt: new Date() } }, { new: true });
      if (!row) row = await Notification.findOne(filter);
    } else row = await Notification.findOneAndUpdate(filter, { $unset: { readAt: '' } }, { new: true });
    if (!row) throw new NotificationError(404, 'Notification not found.');
    res.json({ success: true, data: { notification: await Notification.findOne(filter).select(privateProjection) } });
  } catch (error) { failure(res, error); }
};
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const row = await NotificationPreferences.findOne({ ownerId: req.user!._id });
    res.json({ success: true, data: { preferences: row ? { inApp: row.inApp, categories: row.categories, revision: row.revision } : { ...defaultNotificationPreferences(), revision: 0 }, supportedChannels: ['in_app'] } });
  } catch (error) { failure(res, error); }
};
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    if (req.notificationVerificationOnly) throw new NotificationError(403, 'A full session is required to change notification preferences.');
    const values = notificationPreferencesInput(req.body);
    const row = await mongoose.connection.transaction(async session => {
      const actor = await User.updateOne({ _id: req.user!._id, accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { session, timestamps: false });
      if (!actor.matchedCount) throw new NotificationError(403, 'An active account is required.');
      const current = await NotificationPreferences.findOne({ ownerId: req.user!._id }).session(session);
      if ((current?.revision ?? 0) !== values.revision) throw new NotificationError(409, 'Notification preferences changed. Reload before updating.');
      return NotificationPreferences.findOneAndUpdate({ ownerId: req.user!._id }, { $set: { inApp: values.inApp, categories: values.categories, revision: values.revision + 1 } }, { new: true, upsert: true, runValidators: true, session });
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    res.json({ success: true, data: { preferences: { inApp: row!.inApp, categories: row!.categories, revision: row!.revision }, supportedChannels: ['in_app'] } });
  } catch (error) { failure(res, error); }
};
