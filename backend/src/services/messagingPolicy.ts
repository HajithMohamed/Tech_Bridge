import { Types } from 'mongoose';
import { AdminActionError } from './adminUsers';

export function assertContactPreferences(settings: { ownerId: Types.ObjectId; acceptsMessages?: boolean; blockedIds: Types.ObjectId[] }[], senderId: Types.ObjectId, otherId: Types.ObjectId) {
  if (settings.some((row) => row.blockedIds.some((id) => id.equals(row.ownerId.equals(senderId) ? otherId : senderId)))) throw new AdminActionError(403, 'Messaging is unavailable for this connection.');
  if (settings.find((row) => row.ownerId.equals(otherId))?.acceptsMessages === false) throw new AdminActionError(403, 'This member is not accepting messages.');
}

export function messageId(value: unknown): Types.ObjectId {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AdminActionError(400, 'Invalid message or member ID.');
  return new Types.ObjectId(value);
}
export function messageText(value: unknown, min = 1, max = 2000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new AdminActionError(400, `Enter between ${min} and ${max} characters without control characters.`);
  return value.trim();
}
export function messagePage(value: unknown) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,3}$/.test(value)) throw new AdminActionError(400, 'Page must be between 1 and 9999.');
  return Number(value);
}
export function messagePreferences(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminActionError(400, 'Provide messaging preferences.');
  const values = body as Record<string, unknown>;
  if (Object.keys(values).some((key) => !['acceptsMessages', 'notifications'].includes(key)) || typeof values.acceptsMessages !== 'boolean' || typeof values.notifications !== 'boolean') throw new AdminActionError(400, 'Provide boolean messaging preferences only.');
  return { acceptsMessages: values.acceptsMessages, notifications: values.notifications };
}
export const escapedSearch = (value: unknown) => value === undefined || value === '' ? '' : messageText(value, 1, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
