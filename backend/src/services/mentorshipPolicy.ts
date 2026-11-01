import { Types } from 'mongoose';
import { AdminActionError } from './adminUsers';
import { messageText } from './messagingPolicy';
import type { MentorshipStatus, TimeWindow } from '../models/Mentorship';

export const mentorshipHorizonMs = 90 * 86_400_000;
export function mentorshipBody(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new AdminActionError(400, 'Provide only supported mentorship fields.');
  return value as Record<string, unknown>;
}
export function mentorshipId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new AdminActionError(400, 'Invalid mentorship or member ID.');
  return new Types.ObjectId(value);
}
export function mentorshipRevision(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new AdminActionError(400, 'Provide the current nonnegative revision.');
  return value as number;
}
export function mentorshipPage(value: unknown, fallback = 1, max = 10000) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new AdminActionError(400, `Provide a page or limit between 1 and ${max}.`);
  return Number(value);
}
export function mentorshipDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new AdminActionError(400, 'Use a UTC ISO timestamp with milliseconds.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new AdminActionError(400, 'Invalid calendar date.');
  return date;
}
export function mentorshipWindow(value: unknown, now = new Date(), availability = false): TimeWindow {
  const body = mentorshipBody(value, ['startAt', 'endAt']);
  const startAt = mentorshipDate(body.startAt); const endAt = mentorshipDate(body.endAt);
  const duration = (endAt.getTime() - startAt.getTime()) / 60_000;
  if ((availability ? endAt <= now : startAt <= now) || endAt.getTime() > now.getTime() + mentorshipHorizonMs || duration < 15 || duration > (availability ? 480 : 120) || duration % 15 !== 0 || startAt.getUTCSeconds() !== 0 || startAt.getUTCMilliseconds() !== 0 || startAt.getUTCMinutes() % 15 !== 0) throw new AdminActionError(400, 'Choose future 15-minute boundaries within 90 days; sessions last 15–120 minutes and availability windows 15–480 minutes.');
  return { startAt, endAt };
}
export const overlaps = (a: TimeWindow, b: TimeWindow) => a.startAt < b.endAt && a.endAt > b.startAt;
export const windowContains = (windows: TimeWindow[], slot: TimeWindow) => windows.some(window => window.startAt <= slot.startAt && window.endAt >= slot.endAt);
export function mentorProfileInput(value: unknown, now = new Date()) {
  const body = mentorshipBody(value, ['revision', 'enabled', 'expertise', 'bio', 'timeZone', 'windows']);
  const revision = mentorshipRevision(body.revision);
  if (typeof body.enabled !== 'boolean' || !Array.isArray(body.expertise) || !body.expertise.length || body.expertise.length > 12 || !Array.isArray(body.windows) || body.windows.length > 40) throw new AdminActionError(400, 'Provide consent, 1–12 expertise topics and up to 40 availability windows.');
  const expertise = [...new Set(body.expertise.map(item => messageText(item, 1, 80)))];
  const bio = messageText(body.bio, 20, 1000); const timeZone = messageText(body.timeZone, 1, 80);
  try { new Intl.DateTimeFormat('en', { timeZone }).format(now); } catch { throw new AdminActionError(400, 'Choose a valid IANA time zone.'); }
  const windows = body.windows.map(item => mentorshipWindow(item, now, true)).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  if (windows.some((window, index) => index > 0 && overlaps(windows[index - 1], window))) throw new AdminActionError(400, 'Availability windows must not overlap.');
  return { revision, enabled: body.enabled, expertise, bio, timeZone, windows };
}
export function mentorshipTransition(status: MentorshipStatus, action: string, actor: 'student' | 'mentor', endsAt?: Date, now = new Date()): MentorshipStatus {
  if (action === 'cancel' && ['pending', 'approved', 'scheduled'].includes(status)) return 'cancelled';
  if (actor === 'mentor' && status === 'pending' && action === 'approve') return 'approved';
  if (actor === 'mentor' && status === 'pending' && action === 'reject') return 'rejected';
  if (actor === 'mentor' && status === 'scheduled' && action === 'complete' && endsAt && endsAt <= now) return 'completed';
  throw new AdminActionError(409, 'This mentorship action is not valid for the current state or participant.');
}
/** Return free windows without revealing the owner or purpose of existing bookings. */
export function freeMentorWindows(windows: TimeWindow[], appointments: TimeWindow[], now = new Date()): TimeWindow[] {
  let free = windows.filter(window => window.endAt > now).map(window => ({ startAt: new Date(Math.max(window.startAt.getTime(), Math.ceil((now.getTime() + 1) / 900_000) * 900_000)), endAt: window.endAt }));
  for (const booked of appointments) free = free.flatMap(window => !overlaps(window, booked) ? [window] : [
    ...(window.startAt < booked.startAt ? [{ startAt: window.startAt, endAt: booked.startAt }] : []),
    ...(window.endAt > booked.endAt ? [{ startAt: booked.endAt, endAt: window.endAt }] : []),
  ]);
  return free.filter(window => window.endAt.getTime() - window.startAt.getTime() >= 900_000);
}
