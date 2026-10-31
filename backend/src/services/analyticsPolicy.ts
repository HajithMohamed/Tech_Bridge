import { Types } from 'mongoose';
import type { IUser } from '../models/User';

export type AnalyticsRole = 'student' | 'provider' | 'admin';
export type AnalyticsWindow = { from?: Date; to?: Date };
export class AnalyticsError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
export const applicationStates = ['applied', 'reviewed', 'accepted', 'rejected', 'waitlisted'] as const;
export const resourceStates = ['pending', 'accepted', 'rejected', 'completed', 'waitlisted', 'cancelled'] as const;
export const mentorshipStates = ['pending', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled'] as const;
export const campaignStates = ['draft', 'pending', 'accepted', 'in_progress', 'submitted', 'changes_requested', 'reviewed', 'completed', 'declined', 'cancelled'] as const;
export const opportunityStates = ['draft', 'open', 'closed', 'expired'] as const;
export const opportunityKinds = ['job', 'internship', 'scholarship', 'course', 'freelance', 'promotion', 'workshop', 'mentorship'] as const;
export const accessKinds = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'] as const;

export function analyticsDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new AnalyticsError(400, 'Use canonical UTC timestamps with milliseconds.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new AnalyticsError(400, 'Invalid analytics calendar date.');
  return date;
}
export function analyticsWindow(value: unknown): AnalyticsWindow {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['from', 'to'].includes(key))) throw new AnalyticsError(400, 'Only from and to analytics filters are supported.');
  const input = value as Record<string, unknown>;
  if (input.from === undefined && input.to === undefined) return {};
  const from = analyticsDate(input.from); const to = analyticsDate(input.to);
  if (from >= to || to.getTime() - from.getTime() > 366 * 86400000) throw new AnalyticsError(400, 'Use an increasing analytics window of up to 366 days.');
  return { from, to };
}
export function cohortMatch(window: AnalyticsWindow, field = 'createdAt') {
  return window.from && window.to ? { [field]: { $gte: window.from, $lt: window.to } } : {};
}
export function withinCohort(date: unknown, window: AnalyticsWindow) {
  return date instanceof Date && Number.isFinite(date.getTime()) && (!window.from || date >= window.from) && (!window.to || date < window.to);
}
export function analyticsScope(role: AnalyticsRole, ownerId: Types.ObjectId, window: AnalyticsWindow, field: 'studentId' | 'providerId', timestamp = 'createdAt') {
  return { ...cohortMatch(window, timestamp), ...(role === 'admin' ? {} : { [field]: ownerId }) };
}
export function assertAnalyticsAccount(user: IUser | null, role: AnalyticsRole, tokenVersion: number) {
  if (!user || (user.tokenVersion ?? 0) !== tokenVersion) throw new AnalyticsError(401, 'Your session changed. Please sign in again.');
  if (user.role !== role || !['student', 'provider', 'admin'].includes(role) || user.accountStatus === 'suspended' || (user.requiresEmailVerification && !user.emailVerifiedAt)) throw new AnalyticsError(403, 'An active account with the required role and email verification is needed.');
  if (role === 'provider' && (user.providerProfile?.verified !== true || user.providerProfile.verificationStatus !== 'VERIFIED')) throw new AnalyticsError(403, 'Current provider verification is required.');
}
export function countBuckets(rows: { _id?: unknown; count: number }[] | undefined, allowed: readonly string[]) {
  const result: Record<string, number> = Object.fromEntries([...allowed, 'unknown'].map(key => [key, 0]));
  for (const row of rows ?? []) {
    if (!Number.isSafeInteger(row.count) || row.count < 0) throw new Error('Invalid analytics aggregate.');
    const key = typeof row._id === 'string' && allowed.includes(row._id) ? row._id : 'unknown';
    result[key] += row.count;
    if (!Number.isSafeInteger(result[key])) throw new Error('Analytics count exceeds the supported range.');
  }
  return result;
}
export function sumCounts(buckets: Record<string, number>, keys: readonly string[]) {
  let total = 0;
  for (const key of keys) {
    const count = buckets[key] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(total + count)) throw new Error('Invalid analytics total.');
    total += count;
  }
  return total;
}
export const countTotal = (buckets: Record<string, number>) => sumCounts(buckets, Object.keys(buckets));
