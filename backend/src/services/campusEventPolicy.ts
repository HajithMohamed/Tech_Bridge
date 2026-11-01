import { Types } from 'mongoose';
import type { IUser } from '../models/User';
import type { CampusOrganizerRecord, OrganizerIdentity, CampusEventRecord } from '../models/CampusEvent';
import { campusEventCategories } from '../models/CampusEvent';

export class CampusEventError extends Error { constructor(public readonly statusCode: number, message: string) { super(message); } }
export function eventObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new CampusEventError(400, 'Provide only supported campus event fields.');
  return value as Record<string, unknown>;
}
export function eventText(value: unknown, min = 1, max = 80) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new CampusEventError(400, `Provide plain text of ${min}–${max} characters.`); return value.trim();
}
export function eventId(value: unknown) { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new CampusEventError(400, 'Invalid event, registration or organizer ID.'); return new Types.ObjectId(value); }
export function eventRevision(value: unknown) { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new CampusEventError(400, 'Provide the current nonnegative revision.'); return Number(value); }
export function eventPage(value: unknown, fallback = 1, max = 10000) { if (value === undefined) return fallback; if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new CampusEventError(400, `Provide a page or limit between 1 and ${max}.`); return Number(value); }
export function eventDate(value: unknown): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new CampusEventError(400, 'Use an explicit UTC timestamp with milliseconds.');
  const date = new Date(value); if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new CampusEventError(400, 'Invalid calendar date.'); return date;
}
export function eventCapacity(value: unknown, registered = 0) { if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 10000 || Number(value) < registered) throw new CampusEventError(409, 'Capacity must be 1–10,000 and cannot be below current registrations.'); return Number(value); }
export const campusEventFields = ['title', 'description', 'category', 'mode', 'venue', 'joinInstructions', 'startsAt', 'endsAt', 'registrationClosesAt', 'capacity'] as const;
export function eventInput(value: unknown, now = new Date(), registrationMustBeFuture = false) {
  const body = eventObject(value, campusEventFields); const title = eventText(body.title, 3, 160); const description = eventText(body.description, 20, 5000); const venue = eventText(body.venue, 1, 200);
  if (!campusEventCategories.includes(body.category as typeof campusEventCategories[number]) || !['campus', 'online', 'hybrid'].includes(body.mode as string)) throw new CampusEventError(400, 'Choose a valid event category and mode.');
  const startsAt = eventDate(body.startsAt); const endsAt = eventDate(body.endsAt); const registrationClosesAt = eventDate(body.registrationClosesAt);
  if (startsAt <= now || startsAt.getTime() > now.getTime() + 365 * 86400000 || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 14 * 86400000 || registrationClosesAt > startsAt || (registrationMustBeFuture && registrationClosesAt <= now)) throw new CampusEventError(400, 'Choose a future event within one year, lasting up to 14 days, with registration closing no later than its start.');
  return { title, description, venue, category: body.category as typeof campusEventCategories[number], mode: body.mode as CampusEventRecord['mode'], ...(body.joinInstructions !== undefined ? { joinInstructions: eventText(body.joinInstructions, 0, 1500) } : {}), startsAt, endsAt, registrationClosesAt, capacity: eventCapacity(body.capacity) };
}
export function organizerIdentity(user: IUser): OrganizerIdentity {
  return { role: user.role, name: user.fullName, email: user.email, ...(user.role === 'student' ? { institution: user.studentProfile?.institution?.trim().toLowerCase() } : { documentId: user.providerProfile?.verificationDocumentId, organizationName: user.providerProfile?.organizationName, organizationType: user.providerProfile?.organizationType }) };
}
export function organizerEligible(user: IUser | null, grant: CampusOrganizerRecord | null) {
  if (!user || !grant || grant.status !== 'approved' || !grant.ownerId.equals(user._id) || user.accountStatus === 'suspended' || (user.requiresEmailVerification && !user.emailVerifiedAt) || !['student', 'provider'].includes(user.role)) return false;
  const actual = organizerIdentity(user); const saved = grant.identity;
  if (!saved || actual.role !== saved.role || actual.name !== saved.name || actual.email !== saved.email) return false;
  if (user.role === 'student') return Boolean(actual.institution && actual.institution === saved.institution && actual.institution === grant.institution.trim().toLowerCase());
  return Boolean(user.providerProfile?.verified === true && user.providerProfile.verificationStatus === 'VERIFIED' && actual.documentId && saved.documentId?.equals(actual.documentId) && actual.organizationName === saved.organizationName && actual.organizationType === saved.organizationType);
}
export function eventPublicationActive(event: CampusEventRecord, user: IUser | null, grant: CampusOrganizerRecord | null) { return organizerEligible(user, grant) && grant!.revision === event.grantRevision && grant!.institution === event.institution; }
export function canRecordAttendance(event: Pick<CampusEventRecord, 'status' | 'startsAt' | 'endsAt'>, now = new Date()) {
  return ['published', 'completed'].includes(event.status) && event.startsAt <= now && now.getTime() <= event.endsAt.getTime() + 7 * 86400000;
}
