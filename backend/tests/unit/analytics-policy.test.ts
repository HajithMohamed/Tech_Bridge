import { describe, expect, it } from 'vitest';
import User from '../../src/models/User';
import { analyticsDate, analyticsScope, analyticsWindow, assertAnalyticsAccount, cohortMatch, countBuckets, countTotal, sumCounts, withinCohort } from '../../src/services/analyticsPolicy';
import { adminFixture, ids, providerFixture, studentFixture } from '../support/fixtures';

const from = '2026-01-01T00:00:00.000Z'; const to = '2026-02-01T00:00:00.000Z';
describe('bounded analytics cohort filters', () => {
  it('supports all-time reads and explicit half-open UTC windows', () => {
    expect(analyticsWindow({})).toEqual({}); const window = analyticsWindow({ from, to });
    expect(window).toEqual({ from: new Date(from), to: new Date(to) });
    expect(cohortMatch(window, 'appliedAt')).toEqual({ appliedAt: { $gte: new Date(from), $lt: new Date(to) } }); expect(cohortMatch({})).toEqual({});
    expect(analyticsDate(from)).toEqual(new Date(from));
  });
  it.each([undefined, null, [], { from }, { to }, { from, to, role: 'admin' }, { from, to, studentId: String(ids.student) }, { from, to, providerId: String(ids.provider) }, { from, to, timezone: 'local' }, { from, to, status: 'accepted' }, { from: { $gte: from }, to }, { from: [from], to }, { from: 0, to }, { from, to: from }, { from: to, to: from }, { from, to: '2027-01-03T00:00:00.000Z' }])('rejects malformed, ambiguous or authority-changing filters %j', value => expect(() => analyticsWindow(value)).toThrow());
  it.each(['2026-02-30T00:00:00.000Z', '2026-01-01', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000+00:00', 'not-a-date', '', new Date(from), {}, [], NaN])('rejects noncanonical dates %j', value => expect(() => analyticsDate(value)).toThrow());
  it('accepts the exact 366-day maximum and rejects a longer interval', () => {
    expect(analyticsWindow({ from: '2024-01-01T00:00:00.000Z', to: '2025-01-01T00:00:00.000Z' }).from).toEqual(new Date('2024-01-01'));
    expect(() => analyticsWindow({ from: '2024-01-01T00:00:00.000Z', to: '2025-01-01T00:00:00.001Z' })).toThrow();
  });
  it('includes the beginning, excludes the end and refuses missing historical dates', () => {
    const window = analyticsWindow({ from, to });
    expect(withinCohort(new Date(from), window)).toBe(true); expect(withinCohort(new Date(to), window)).toBe(false); expect(withinCohort(new Date(new Date(from).getTime() - 1), window)).toBe(false);
    expect(withinCohort(undefined, {})).toBe(false); expect(withinCohort(new Date('invalid'), {})).toBe(false);
  });
  it('constructs server-owned scope and uses application timestamps explicitly', () => {
    const window = analyticsWindow({ from, to });
    expect(analyticsScope('student', ids.student, window, 'studentId', 'appliedAt')).toEqual({ studentId: ids.student, appliedAt: { $gte: window.from, $lt: window.to } });
    expect(analyticsScope('provider', ids.provider, {}, 'providerId')).toEqual({ providerId: ids.provider });
    expect(analyticsScope('admin', ids.admin, {}, 'providerId')).toEqual({});
  });
});
describe('metric calculation, fixed buckets and honest empty datasets', () => {
  it('combines duplicate buckets and reports unrecognized legacy statuses separately', () => {
    const value = countBuckets([{ _id: 'accepted', count: 2 }, { _id: 'accepted', count: 1 }, { _id: 'rejected', count: 4 }, { _id: null, count: 1 }, { _id: '__proto__', count: 1 }], ['accepted', 'rejected', 'pending']);
    expect(value).toEqual({ accepted: 3, rejected: 4, pending: 0, unknown: 2 }); expect(countTotal(value)).toBe(9); expect(sumCounts(value, ['accepted', 'pending'])).toBe(3);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });
  it('returns stable zero buckets without hardcoded activity or fake percentages', () => { expect(countBuckets(undefined, ['accepted', 'pending'])).toEqual({ accepted: 0, pending: 0, unknown: 0 }); expect(countTotal({})).toBe(0); expect(sumCounts({}, ['missing'])).toBe(0); });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuses invalid count %s', count => { expect(() => countBuckets([{ _id: 'accepted', count }], ['accepted'])).toThrow(); expect(() => countTotal({ accepted: count })).toThrow(); });
  it('refuses overflow rather than silently rounding aggregate results', () => { expect(() => countBuckets([{ _id: 'accepted', count: Number.MAX_SAFE_INTEGER }, { _id: 'accepted', count: 1 }], ['accepted'])).toThrow(); expect(() => countTotal({ accepted: Number.MAX_SAFE_INTEGER, pending: 1 })).toThrow(); });
});
describe('analytics authorization is checked against the current snapshot account', () => {
  it.each([studentFixture(), providerFixture(), adminFixture()])('accepts an eligible current $role account', fixture => expect(() => assertAnalyticsAccount(new User(fixture), fixture.role as 'student' | 'provider' | 'admin', 0)).not.toThrow());
  it('rejects missing or revoked sessions and role changes', () => {
    expect(() => assertAnalyticsAccount(null, 'student', 0)).toThrow(); expect(() => assertAnalyticsAccount(new User(studentFixture({ tokenVersion: 1 })), 'student', 0)).toThrow(); expect(() => assertAnalyticsAccount(new User(studentFixture()), 'admin', 0)).toThrow();
  });
  it.each([{ accountStatus: 'suspended' }, { requiresEmailVerification: true }])('rejects an ineligible account %j', changes => expect(() => assertAnalyticsAccount(new User(studentFixture(changes)), 'student', 0)).toThrow());
  it('honors completed email verification and the current token version', () => expect(() => assertAnalyticsAccount(new User(studentFixture({ requiresEmailVerification: true, emailVerifiedAt: new Date(), tokenVersion: 2 })), 'student', 2)).not.toThrow());
  it.each([{ verified: false }, { verificationStatus: 'PENDING' }, { verificationStatus: 'REJECTED' }])('rejects withdrawn provider verification %j', changes => { const fixture = providerFixture(); expect(() => assertAnalyticsAccount(new User({ ...fixture, providerProfile: { ...fixture.providerProfile, ...changes } }), 'provider', 0)).toThrow(); });
});
