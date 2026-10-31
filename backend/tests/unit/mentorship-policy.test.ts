import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { freeMentorWindows, mentorProfileInput, mentorshipBody, mentorshipDate, mentorshipId, mentorshipPage, mentorshipRevision, mentorshipTransition, mentorshipWindow, overlaps, windowContains } from '../../src/services/mentorshipPolicy';
import { mentorIdentityEligible } from '../../src/services/mentorship';
import User from '../../src/models/User';
import { MentorApproval } from '../../src/models/Mentorship';
import { CommunityClaim } from '../../src/models/CommunityClaim';
import { lecturerFixture, providerFixture, ids } from '../support/fixtures';

const now = new Date('2030-01-01T00:00:00.000Z');
const slot = (start = '2030-01-02T10:00:00.000Z', end = '2030-01-02T11:00:00.000Z') => ({ startAt: start, endAt: end });
const profile = () => ({ revision: 0, enabled: true, expertise: ['TypeScript'], bio: 'Synthetic mentor biography for unit testing.', timeZone: 'Asia/Colombo', windows: [slot()] });
const window = () => mentorshipWindow(slot(), now);
describe('bounded mentorship input and time semantics', () => {
  it.each([undefined, [], 'body', { role: 'admin' }])('rejects unsupported body %j', value => { expect(() => mentorshipBody(value, ['revision'])).toThrow(); });
  it.each(['bad', '123456789012', { $ne: null }])('rejects malformed IDs %j', value => { expect(() => mentorshipId(value)).toThrow(); });
  it('accepts only explicit canonical UTC timestamps and valid calendar dates', () => {
    expect(mentorshipDate(slot().startAt)).toEqual(new Date(slot().startAt));
    for (const date of ['2030-02-30T10:00:00.000Z', '2030-01-02T10:00:00', '2030-01-02T10:00:00+05:30', '2030-01-02', 123]) expect(() => mentorshipDate(date)).toThrow();
  });
  it.each([-1, 0.5, '0', Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %j', value => { expect(() => mentorshipRevision(value)).toThrow(); });
  it('supports revision zero only as a valid integer and bounds pagination', () => {
    expect(mentorshipRevision(0)).toBe(0); expect(mentorshipPage(undefined, 20, 50)).toBe(20);
    for (const page of ['0', '51', '1.5', ['1'], { $gt: 1 }]) expect(() => mentorshipPage(page, 20, 50)).toThrow();
  });
  it.each([
    slot('2029-12-31T10:00:00.000Z'), slot('2030-05-01T10:00:00.000Z', '2030-05-01T11:00:00.000Z'),
    slot(undefined, '2030-01-02T09:00:00.000Z'), slot(undefined, '2030-01-02T10:10:00.000Z'),
    slot('2030-01-02T10:01:00.000Z'), slot('2030-01-02T10:00:01.000Z'), slot(undefined, '2030-01-02T12:15:00.000Z'),
  ])('rejects invalid appointment %j', value => { expect(() => mentorshipWindow(value, now)).toThrow(); });
  it('accepts minimum and maximum session durations and longer bounded availability', () => {
    expect(mentorshipWindow(slot(undefined, '2030-01-02T10:15:00.000Z'), now)).toBeTruthy();
    expect(mentorshipWindow(slot(undefined, '2030-01-02T12:00:00.000Z'), now)).toBeTruthy();
    expect(mentorshipWindow(slot(undefined, '2030-01-02T18:00:00.000Z'), now, true)).toBeTruthy();
  });
  it('keeps an ongoing availability window while rejecting ended windows', () => {
    const during = new Date('2030-01-02T10:30:00.000Z');
    expect(mentorProfileInput(profile(), during).windows).toHaveLength(1);
    expect(() => mentorProfileInput(profile(), new Date('2030-01-02T11:00:00.000Z'))).toThrow();
  });
  it('requires explicit opt-in, expertise, bounded availability and a real time zone', () => {
    expect(mentorProfileInput({ ...profile(), expertise: ['TypeScript', 'TypeScript'] }, now).expertise).toEqual(['TypeScript']);
    for (const change of [{ enabled: 'true' }, { expertise: [] }, { expertise: Array(13).fill('a') }, { timeZone: 'Invented/Zone' }, { windows: Array(41).fill(slot()) }, { bio: 'short' }, { approved: true }]) expect(() => mentorProfileInput({ ...profile(), ...change }, now)).toThrow();
  });
  it('rejects overlapping windows and permits adjacent windows without double booking their boundary', () => {
    expect(() => mentorProfileInput({ ...profile(), windows: [slot(), slot()] }, now)).toThrow();
    const a = window(); const b = mentorshipWindow(slot('2030-01-02T11:00:00.000Z', '2030-01-02T12:00:00.000Z'), now);
    expect(overlaps(a, b)).toBe(false); expect(windowContains([a, b], { startAt: a.startAt, endAt: b.endAt })).toBe(false);
  });
  it('subtracts occupied intervals without revealing private booking data', () => {
    const outer = mentorshipWindow(slot(undefined, '2030-01-02T14:00:00.000Z'), now, true);
    const booked = mentorshipWindow(slot('2030-01-02T11:00:00.000Z', '2030-01-02T12:00:00.000Z'), now);
    expect(freeMentorWindows([outer], [booked], now)).toEqual([{ startAt: outer.startAt, endAt: booked.startAt }, { startAt: booked.endAt, endAt: outer.endAt }]);
    expect(freeMentorWindows([outer], [outer], now)).toEqual([]);
  });
  it('clips ongoing windows to future quarter hours and omits shorter fragments', () => {
    expect(freeMentorWindows([window()], [], new Date('2030-01-02T10:40:00.000Z'))).toEqual([{ startAt: new Date('2030-01-02T10:45:00.000Z'), endAt: window().endAt }]);
    expect(freeMentorWindows([window()], [], new Date('2030-01-02T10:50:00.000Z'))).toEqual([]);
  });
});
describe('mentorship transitions and current mentor identity', () => {
  it('allows mentor review, either participant cancellation and completion after the end', () => {
    expect(mentorshipTransition('pending', 'approve', 'mentor')).toBe('approved');
    expect(mentorshipTransition('pending', 'reject', 'mentor')).toBe('rejected');
    expect(mentorshipTransition('scheduled', 'cancel', 'student')).toBe('cancelled');
    expect(mentorshipTransition('scheduled', 'complete', 'mentor', now, now)).toBe('completed');
  });
  it.each([
    ['pending', 'approve', 'student'], ['approved', 'reject', 'mentor'], ['cancelled', 'approve', 'mentor'],
    ['completed', 'cancel', 'student'], ['scheduled', 'complete', 'student'], ['scheduled', 'complete', 'mentor'],
  ] as const)('rejects invalid transition %s/%s/%s', (status, action, role) => { expect(() => mentorshipTransition(status, action, role, new Date(now.getTime() + 1), now)).toThrow(); });
  it('does not turn a verified organization or unclaimed faculty listing into an approved mentor', () => {
    expect(mentorIdentityEligible(new User(providerFixture()), null, null)).toBe(false);
    expect(mentorIdentityEligible(new User(lecturerFixture()), null, null)).toBe(false);
  });
  it('binds industry approval to an active verified individual and current evidence', () => {
    const documentId = new Types.ObjectId(); const user = new User(providerFixture({ providerProfile: { ...providerFixture().providerProfile, organizationType: 'individual', verificationDocumentId: documentId } }));
    const approval = new MentorApproval({ ownerId: ids.provider, documentId, status: 'approved', revision: 1, actorId: ids.admin, reason: 'Synthetic independent approval.' });
    expect(mentorIdentityEligible(user, null, approval)).toBe(true);
    for (const change of [{ status: 'revoked' }, { documentId: new Types.ObjectId() }, { ownerId: ids.outsider }]) expect(mentorIdentityEligible(user, null, new MentorApproval({ ...approval.toObject(), ...change }))).toBe(false);
    user.accountStatus = 'suspended'; expect(mentorIdentityEligible(user, null, approval)).toBe(false);
  });
  it('requires a visible matching verified community identity and respects withdrawal', () => {
    const documentId = new Types.ObjectId(); const user = new User({ ...lecturerFixture(), providerProfile: { ...lecturerFixture().providerProfile, verificationDocumentId: documentId } });
    const claim = new CommunityClaim({ providerId: ids.lecturer, documentId, directoryId: 'ict-chandana', status: 'APPROVED', profile: { visibility: 'members' } });
    expect(mentorIdentityEligible(user, claim, null)).toBe(true);
    claim.profile.visibility = 'hidden'; expect(mentorIdentityEligible(user, claim, null)).toBe(false);
    claim.profile.visibility = 'members'; user.requiresEmailVerification = true; expect(mentorIdentityEligible(user, claim, null)).toBe(false);
  });
});
