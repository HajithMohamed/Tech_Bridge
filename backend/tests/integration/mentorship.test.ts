import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import { CommunityClaim } from '../../src/models/CommunityClaim';
import { MentorApproval, MentorProfile, Mentorship, MentorshipEvent } from '../../src/models/Mentorship';
import { VerificationDocument } from '../../src/models/ProviderVerification';
import MessagingSettings from '../../src/models/MessagingSettings';
import Notification from '../../src/models/Notification';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { changeMentorship } from '../../src/services/mentorship';
import { runNotificationBatch } from '../../src/services/notificationDelivery';
import { enqueueNotificationReminders } from '../../src/services/notificationReminders';
import { defaultNotificationPreferences } from '../../src/services/notificationPolicy';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, alumniFixture, ids, lecturerFixture, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const documentIds = { lecturer: new Types.ObjectId(), alumni: new Types.ObjectId(), industry: new Types.ObjectId() };
const base = new Date(Math.ceil((Date.now() + 6 * 3600_000) / 900_000) * 900_000);
const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000).toISOString();
const slot = (start = 0, end = 60) => ({ startAt: at(start), endAt: at(end) });
const profile = (changes = {}) => ({ revision: 0, enabled: true, expertise: ['TypeScript', 'Career guidance'], bio: 'Synthetic mentor profile for an isolated test database.', timeZone: 'Asia/Colombo', windows: [slot(0, 240)], ...changes });
const role = (id: Types.ObjectId) => id.equals(ids.admin) ? 'admin' : [ids.student, ids.outsider].some(student => student.equals(id)) ? 'student' : 'provider';
const token = (id: Types.ObjectId) => generateToken(String(id), role(id));
const api = (method: 'get' | 'post' | 'put', path: string, id = ids.student) => request(app)[method](`/api/mentorship${path}`).auth(token(id), { type: 'bearer' });
async function enable(id = ids.lecturer, changes = {}) {
  const response = await api('put', '/profile', id).send(profile(changes)); expect(response.status, JSON.stringify(response.body)).toBe(200); return response.body.data.profile;
}
async function create(student = ids.student, mentor = ids.lecturer) {
  const response = await api('post', '/sessions', student).send({ mentorId: String(mentor), topic: 'Synthetic mentoring topic', message: 'Private student goals and background for isolated tests.' }); expect(response.status, JSON.stringify(response.body)).toBe(201); return response.body.data.session;
}
type Session = { _id: string; revision: number; status: string };
const act = (row: Session, action: string, id = ids.lecturer, changes = {}) => api('post', `/sessions/${row._id}/${action}`, id).send({ revision: row.revision, ...changes });
async function approved(student = ids.student, mentor = ids.lecturer) { const row = await create(student, mentor); const response = await act(row, 'approve', mentor); expect(response.status).toBe(200); return response.body.data.session; }
async function booked(student = ids.student, mentor = ids.lecturer, start = 0, end = 60) {
  const row = await approved(student, mentor); const proposed = await act(row, 'schedule', mentor, slot(start, end)); expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
  const accepted = await act(proposed.body.data.session, 'schedule/accept', student); expect(accepted.status, JSON.stringify(accepted.body)).toBe(200); return accepted.body.data.session;
}
async function reviewIndustry() {
  const response = await request(app).get(`/api/admin/providers/${ids.provider}/documents/${documentIds.industry}`).auth(token(ids.admin), { type: 'bearer' }); expect(response.status).toBe(200);
}
const approveIndustry = (changes = {}, id = ids.admin) => api('put', `/admin/mentors/${ids.provider}/approval`, id).send({ revision: 0, status: 'approved', documentId: String(documentIds.industry), reason: 'Synthetic independent expertise and identity review.', identityConfirmed: true, expertiseConfirmed: true, ...changes });
beforeAll(() => database.start());
beforeEach(async () => {
  await database.clear();
  await User.create([
    adminFixture(), studentFixture(), studentFixture({ _id: ids.outsider, email: 'other-student@example.test' }),
    { ...lecturerFixture(), providerProfile: { ...lecturerFixture().providerProfile, verificationDocumentId: documentIds.lecturer } },
    { ...alumniFixture(), providerProfile: { ...alumniFixture().providerProfile, verificationDocumentId: documentIds.alumni } },
    providerFixture({ providerProfile: { ...providerFixture().providerProfile, organizationType: 'individual', verificationDocumentId: documentIds.industry } }),
  ]);
  await VerificationDocument.create(Object.entries(documentIds).map(([kind, _id]) => ({ _id, providerId: kind === 'lecturer' ? ids.lecturer : kind === 'alumni' ? ids.alumni : ids.provider, fileName: 'synthetic.pdf', contentType: 'application/pdf', size: 20, data: Buffer.from('%PDF-synthetic-test'), sha256: 'synthetic-hash' })));
  await CommunityClaim.create([
    { providerId: ids.lecturer, directoryId: 'ict-chandana', documentId: documentIds.lecturer, institution: 'Synthetic test affiliation', justification: 'Synthetic claim fixture, never production identity proof.', status: 'APPROVED', revision: 1, profile: { visibility: 'members', acceptsStudentMessages: true, expertise: ['TypeScript'], availability: 'Synthetic hours', bio: 'Synthetic faculty profile.' } },
    { providerId: ids.alumni, directoryId: 'alumni-rishitha', documentId: documentIds.alumni, institution: 'Synthetic test affiliation', justification: 'Synthetic claim fixture, never production identity proof.', status: 'APPROVED', revision: 1, profile: { visibility: 'members', acceptsStudentMessages: true, expertise: ['TypeScript'], availability: 'Synthetic hours', bio: 'Synthetic alumni profile.' } },
  ]);
});
afterAll(() => database.stop());

describe('mentor consent, discovery and independent approval', () => {
  it('requires normal authenticated, email-verified, nonsuspended sessions', async () => {
    expect((await request(app).get('/api/mentorship/mentors')).status).toBe(401);
    expect((await request(app).get('/api/mentorship/profile').auth(generateVerificationToken(String(ids.lecturer)), { type: 'bearer' })).status).toBe(401);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await api('get', '/mentors')).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: false, accountStatus: 'suspended' }); expect((await api('get', '/mentors')).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'active', tokenVersion: 1 }); expect((await api('get', '/mentors')).status).toBe(401);
  });
  it('defaults to no mentor publication and exposes no private identity evidence', async () => {
    expect((await api('get', '/mentors')).body.data.total).toBe(0);
    const own = await api('get', '/profile', ids.lecturer); expect(own.body.data).toMatchObject({ profile: null, identityEligible: true });
    await enable(); const response = await api('get', '/mentors'); expect(response.body.data.total).toBe(1); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.mentors[0]).toMatchObject({ mentorId: String(ids.lecturer), category: 'faculty', department: 'ICT' });
    expect(JSON.stringify(response.body)).not.toMatch(/@|documentId|decisionReason|justification|identityKey|Private|password|Synthetic Lecturer/);
  });
  it('requires an approved visible community claim with current matching evidence', async () => {
    for (const change of [{ status: 'PENDING' }, { 'profile.visibility': 'hidden' }, { documentId: new Types.ObjectId() }]) {
      await CommunityClaim.updateOne({ providerId: ids.lecturer }, { $set: change }); expect((await api('put', '/profile', ids.lecturer).send(profile())).status).toBe(403);
      await CommunityClaim.updateOne({ providerId: ids.lecturer }, { $set: { status: 'APPROVED', 'profile.visibility': 'members', documentId: documentIds.lecturer } });
    }
    await CommunityClaim.deleteOne({ providerId: ids.lecturer }); expect((await api('put', '/profile', ids.lecturer).send(profile())).status).toBe(403);
  });
  it('supports alumni profiles and literal expertise, name, department filters with stable pagination', async () => {
    await enable(); await enable(ids.alumni);
    expect((await api('get', '/mentors?expertise=typescript')).body.data.total).toBe(2);
    expect((await api('get', '/mentors?department=ICT')).body.data.total).toBe(1);
    expect((await api('get', '/mentors?q=.*')).body.data.total).toBe(0);
    const first = await api('get', '/mentors?limit=1'); const second = await api('get', '/mentors?limit=1&page=2');
    expect(first.body.data.total).toBe(2); expect(first.body.data.mentors[0].mentorId).not.toBe(second.body.data.mentors[0].mentorId);
    expect((await api('get', '/mentors?q=chandana')).body.data.total).toBe(1);
  });
  it('requires renewed mentor opt-in after the verified identity evidence changes', async () => {
    await enable(); const replacement = new Types.ObjectId();
    await VerificationDocument.create({ _id: replacement, providerId: ids.lecturer, fileName: 'synthetic-new.pdf', contentType: 'application/pdf', size: 20, data: Buffer.from('%PDF-synthetic-new'), sha256: 'synthetic-new-hash' });
    await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verificationDocumentId': replacement }); await CommunityClaim.updateOne({ providerId: ids.lecturer }, { documentId: replacement });
    expect((await api('get', '/mentors')).body.data.total).toBe(0); expect((await api('get', '/profile', ids.lecturer)).body.data).toMatchObject({ identityEligible: true, acceptingRequests: false });
    expect((await api('put', '/profile', ids.lecturer).send(profile({ revision: 1 }))).status).toBe(200); expect((await api('get', '/mentors')).body.data.total).toBe(1);
  });
  it('bounds discovery input and rejects role escalation and profile overposting', async () => {
    for (const path of ['/mentors?page=0', '/mentors?limit=21', '/mentors?q[$ne]=x', '/mentors?q=a&q=b', '/mentors?ownerId=bad']) expect((await api('get', path)).status).toBe(400);
    expect((await api('put', '/profile').send(profile())).status).toBe(403);
    expect((await api('put', '/profile', ids.lecturer).send(profile({ ownerId: String(ids.alumni) }))).status).toBe(400);
    expect((await api('get', '/mentors', ids.provider)).status).toBe(403);
  });
  it('allows only one concurrent profile edit for the current revision', async () => {
    const responses = await Promise.all([api('put', '/profile', ids.lecturer).send(profile()), api('put', '/profile', ids.lecturer).send(profile({ enabled: false }))]);
    expect(responses.map(row => row.status).sort()).toEqual([200, 409]); expect((await MentorProfile.findOne())?.revision).toBe(1);
  });
  it('honors both block lists and global/community contact withdrawal for discovery and requests', async () => {
    await enable();
    for (const settings of [{ ownerId: ids.lecturer, blockedIds: [ids.student] }, { ownerId: ids.student, blockedIds: [ids.lecturer] }, { ownerId: ids.lecturer, acceptsMessages: false }, { ownerId: ids.student, acceptsMessages: false }]) {
      await MessagingSettings.create(settings); expect((await api('get', '/mentors')).body.data.total).toBe(0);
      expect((await api('get', `/mentors/${ids.lecturer}/availability`)).status).toBe(404);
      expect((await api('post', '/sessions').send({ mentorId: String(ids.lecturer), topic: 'Test mentoring', message: 'Synthetic mentoring request explanation.' })).status).toBeGreaterThanOrEqual(400); await MessagingSettings.deleteMany({});
    }
    await CommunityClaim.updateOne({ providerId: ids.lecturer }, { 'profile.acceptsStudentMessages': false }); expect((await api('get', '/mentors')).body.data.total).toBe(0);
  });
  it('requires independent admin approval and review of current industry evidence', async () => {
    expect((await api('put', '/profile', ids.provider).send(profile())).status).toBe(403);
    expect((await approveIndustry({}, ids.lecturer)).status).toBe(403);
    expect((await approveIndustry({ identityConfirmed: false })).status).toBe(400);
    expect((await approveIndustry()).status).toBe(409);
    await reviewIndustry(); expect((await approveIndustry()).status).toBe(200); await enable(ids.provider);
    expect((await api('get', '/mentors')).body.data.mentors[0]).toMatchObject({ mentorId: String(ids.provider), category: 'individual' });
    const audit = await AuditLog.findOne({ action: 'industry_mentor_approved' }); expect(audit?.mentorshipApproval?.documentId).toEqual(documentIds.industry);
    expect((await api('get', '/admin/mentors', ids.admin)).body.data.total).toBe(1); expect((await api('get', '/admin/mentors')).status).toBe(403);
    expect((await approveIndustry({ revision: 1 })).status).toBe(409); expect((await MentorApproval.findOne())?.revision).toBe(1);
  });
  it('never treats organizational provider verification as personal industry mentor approval', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.organizationType': 'ngo' }); await reviewIndustry();
    expect((await approveIndustry()).status).toBe(409); expect((await api('put', '/profile', ids.provider).send(profile({ enabled: false }))).status).toBe(403);
  });
  it('serializes industry decisions and makes evidence changes invalidate prior approval', async () => {
    await reviewIndustry(); const decisions = await Promise.all([approveIndustry(), approveIndustry()]); expect(decisions.map(row => row.status).sort()).toEqual([200, 409]);
    await enable(ids.provider); await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationDocumentId': new Types.ObjectId() }); expect((await api('get', '/mentors')).body.data.total).toBe(0);
  });
  it('withdraws opt-in on industry revocation and does not republish after reapproval', async () => {
    await reviewIndustry(); await approveIndustry(); await enable(ids.provider);
    expect((await approveIndustry({ revision: 1, status: 'revoked' })).status).toBe(200); expect((await api('get', '/mentors')).body.data.total).toBe(0);
    expect((await MentorProfile.findOne())?.enabled).toBe(false); expect((await approveIndustry({ revision: 2 })).status).toBe(200);
    expect((await api('get', '/mentors')).body.data.total).toBe(0); expect(await AuditLog.countDocuments({ action: /^industry_mentor_/ })).toBe(3);
    const history = await api('get', `/admin/mentors/${ids.provider}/history?limit=2`, ids.admin); expect(history.body.data.total).toBe(3); expect(history.body.data.events).toHaveLength(2); expect(history.body.data.events[0].mentorshipApproval.documentId).toBe(String(documentIds.industry));
    expect((await api('get', `/admin/mentors/${ids.provider}/history`, ids.provider)).status).toBe(403);
  });
});

describe('private session request and appointment lifecycle', () => {
  beforeEach(() => enable());
  it('persists a request, mentor approval, mutual scheduling, completion and history', async () => {
    const row = await booked(); expect(row).toMatchObject({ status: 'scheduled', revision: 4, appointment: slot() });
    expect((await api('get', `/sessions/${row._id}`)).body.data.session._id).toBe(row._id);
    const history = await api('get', `/sessions/${row._id}/history?limit=2`); expect(history.body.data.total).toBe(4); expect(history.body.data.events).toHaveLength(2);
    expect((await act(row, 'complete')).status).toBe(409);
    const completed = await changeMentorship(ids.lecturer, row._id, 'complete', { revision: row.revision }, new Date(base.getTime() + 3600_001)); expect(completed.status).toBe('completed');
    expect((await api('get', '/sessions?status=completed')).body.data.total).toBe(1); expect(await MentorshipEvent.countDocuments()).toBe(5);
  });
  it('keeps session details and history private from unrelated users and administrators', async () => {
    const row = await create();
    for (const user of [ids.outsider, ids.alumni]) for (const suffix of ['', '/history']) expect((await api('get', `/sessions/${row._id}${suffix}`, user)).status).toBe(404);
    expect((await api('get', `/sessions/${row._id}`, ids.admin)).status).toBe(403); expect((await api('get', '/sessions', ids.outsider)).body.data.total).toBe(0);
    expect((await api('get', `/sessions/${row._id}`, ids.lecturer)).body.data.session.message).toContain('Private student goals');
  });
  it('rejects unauthorized decisions, unsupported transitions and stale revisions', async () => {
    const row = await create(); expect((await act(row, 'approve', ids.student)).status).toBe(403); expect((await act(row, 'reject', ids.student, { reason: 'Not my decision.' })).status).toBe(403);
    expect((await act(row, 'approve', ids.alumni)).status).toBe(404); expect((await act(row, 'complete')).status).toBe(409);
    expect((await act(row, 'approve')).status).toBe(200); expect((await act(row, 'approve')).status).toBe(409);
    expect((await api('post', `/sessions/${row._id}/cancel`).send({ revision: 2, reason: 'Cancel request.', studentId: String(ids.outsider) })).status).toBe(400);
  });
  it('supports rejection with a private reason and a later fresh request', async () => {
    const row = await create(); expect((await act(row, 'reject')).status).toBe(400);
    const rejected = await act(row, 'reject', ids.lecturer, { reason: 'Private rejection explanation.' }); expect(rejected.body.data.session.status).toBe('rejected');
    expect((await create()).status).toBe('pending'); expect(await Mentorship.countDocuments()).toBe(2);
  });
  it('prevents duplicate active requests including concurrent submissions', async () => {
    const send = () => api('post', '/sessions').send({ mentorId: String(ids.lecturer), topic: 'Test concurrency', message: 'Synthetic concurrent mentorship request.' });
    const responses = await Promise.all([send(), send()]); expect(responses.map(row => row.status).sort()).toEqual([201, 409]); expect(await Mentorship.countDocuments()).toBe(1); expect(await MentorshipEvent.countDocuments()).toBe(1);
  });
  it('validates required text, IDs and bounded requests and lists', async () => {
    for (const body of [{ mentorId: 'bad' }, { mentorId: String(ids.lecturer), topic: 'a', message: 'short' }, { mentorId: String(ids.lecturer), topic: 'Test', message: 'a'.repeat(1001) }, { mentorId: String(ids.lecturer), topic: 'Test', message: 'Valid synthetic mentoring message.', status: 'approved' }]) expect((await api('post', '/sessions').send(body)).status).toBe(400);
    for (const path of ['/sessions?limit=51', '/sessions?status=unknown', '/sessions?studentId=x', '/sessions/bad', '/sessions/000000000000000000000099/history']) expect((await api('get', path)).status).toBeGreaterThanOrEqual(400);
  });
  it('limits requests to ten in a rolling day using stored records', async () => {
    await Mentorship.insertMany(Array.from({ length: 10 }, () => ({ mentorId: ids.alumni, studentId: ids.student, topic: 'Synthetic old request', message: 'Synthetic history for deterministic rate-limit test.', status: 'cancelled', revision: 1 })));
    expect((await api('post', '/sessions').send({ mentorId: String(ids.lecturer), topic: 'New session', message: 'Synthetic mentoring request explanation.' })).status).toBe(429);
  });
  it('does not reserve a proposed appointment until the other participant accepts', async () => {
    const row = await approved(); const proposed = await act(row, 'schedule', ids.lecturer, slot()); const proposal = proposed.body.data.session;
    expect(proposal.status).toBe('approved'); expect(proposal.appointment).toBeUndefined(); expect((await act(proposal, 'schedule/accept')).status).toBe(403);
    expect((await act(proposal, 'schedule/accept', ids.student)).body.data.session.status).toBe('scheduled');
  });
  it('allows student proposed scheduling and mentor confirmation', async () => {
    const row = await approved(); const proposed = await act(row, 'schedule', ids.student, slot()); expect(proposed.status).toBe(200);
    expect((await act(proposed.body.data.session, 'schedule/accept', ids.lecturer)).body.data.session.status).toBe('scheduled');
  });
  it('requires mentor availability and rejects past, malformed, out-of-range or overly long bookings', async () => {
    const row = await approved();
    for (const value of [slot(240, 300), slot(0, 135), { startAt: '2020-01-01T00:00:00.000Z', endAt: '2020-01-01T01:00:00.000Z' }, { startAt: at(0).replace('.000Z', '+05:30'), endAt: at(60) }]) expect((await act(row, 'schedule', ids.lecturer, value)).status).toBeGreaterThanOrEqual(400);
    expect((await Mentorship.findById(row._id))?.proposal).toBeUndefined();
  });
  it('allows declining a proposal with history while preserving the approved request', async () => {
    const row = await approved(); const proposed = await act(row, 'schedule', ids.lecturer, slot()); const declined = await act(proposed.body.data.session, 'schedule/decline', ids.student, { reason: 'The proposed time is unsuitable.' });
    expect(declined.body.data.session.status).toBe('approved'); expect(declined.body.data.session.proposal).toBeUndefined(); expect((await MentorshipEvent.findOne({ action: 'decline' }))?.reason).toContain('unsuitable');
  });
  it('rejects a proposal that expired before acceptance and leaves the request unchanged', async () => {
    const row = await approved(); const proposed = (await act(row, 'schedule', ids.lecturer, slot())).body.data.session;
    await expect(changeMentorship(ids.student, row._id, 'accept', { revision: proposed.revision }, new Date(base.getTime() + 1))).rejects.toMatchObject({ statusCode: 400 });
    expect((await Mentorship.findById(row._id))?.status).toBe('approved'); expect(await MentorshipEvent.countDocuments()).toBe(3);
  });
  it('reschedules only by mutual agreement, retaining the original appointment until acceptance', async () => {
    const row = await booked(); const proposed = await act(row, 'schedule', ids.student, { ...slot(60, 120), reason: 'Please change the appointment time.' });
    expect(proposed.body.data.session.appointment).toEqual(slot());
    const accepted = await act(proposed.body.data.session, 'schedule/accept'); expect(accepted.body.data.session.appointment).toEqual(slot(60, 120));
    const old = await MentorshipEvent.findOne({ action: 'propose', revision: 5 }); expect(old?.appointment?.startAt.toISOString()).toBe(at(0));
  });
  it('retains the confirmed appointment after the other participant declines a reschedule', async () => {
    const row = await booked(); const proposed = await act(row, 'schedule', ids.student, slot(60, 120));
    const declined = await act(proposed.body.data.session, 'schedule/decline', ids.lecturer, { reason: 'Keep our original appointment.' }); expect(declined.body.data.session.appointment).toEqual(slot()); expect(declined.body.data.session.status).toBe('scheduled');
  });
  it('blocks availability edits that remove confirmed appointments and allows disabling new requests', async () => {
    const row = await booked();
    expect((await api('put', '/profile', ids.lecturer).send(profile({ revision: 1, windows: [slot(120, 240)] }))).status).toBe(409);
    expect((await api('put', '/profile', ids.lecturer).send(profile({ revision: 1, enabled: false }))).status).toBe(200);
    expect((await api('get', '/mentors')).body.data.total).toBe(0); expect((await api('get', `/sessions/${row._id}`)).status).toBe(200);
    expect((await act(row, 'cancel', ids.student, { reason: 'Cancel after availability withdrawal.' })).body.data.session.status).toBe('cancelled');
  });
  it('rechecks claim withdrawal and blocking at approval and appointment acceptance', async () => {
    const row = await approved(); const proposed = await act(row, 'schedule', ids.lecturer, slot());
    await MessagingSettings.create({ ownerId: ids.lecturer, blockedIds: [ids.student] }); expect((await act(proposed.body.data.session, 'schedule/accept', ids.student)).status).toBe(403);
    await MessagingSettings.deleteMany({}); await CommunityClaim.updateOne({ providerId: ids.lecturer }, { status: 'REVOKED' }); expect((await act(proposed.body.data.session, 'schedule/accept', ids.student)).status).toBe(409);
    expect((await act(proposed.body.data.session, 'cancel', ids.student, { reason: 'Cancel after verification withdrawal.' })).status).toBe(200);
  });
  it('permits student cancellation when the other participant is suspended', async () => {
    const row = await booked(); await User.updateOne({ _id: ids.lecturer }, { accountStatus: 'suspended' });
    expect((await act(row, 'cancel', ids.student, { reason: 'Close this unavailable appointment.' })).status).toBe(200);
  });
  it('serializes simultaneous cancel and accept actions at the same revision', async () => {
    const row = await approved(); const proposed = await act(row, 'schedule', ids.lecturer, slot()); const current = proposed.body.data.session;
    const results = await Promise.all([act(current, 'schedule/accept', ids.student), act(current, 'cancel', ids.lecturer, { reason: 'Withdraw this pending appointment.' })]); expect(results.map(row => row.status).sort()).toEqual([200, 409]);
    expect(await MentorshipEvent.countDocuments()).toBe(4);
  });
  it('rolls back the request and history if transactional notification persistence fails', async () => {
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Synthetic storage failure with private driver details.'));
    const response = await api('post', '/sessions').send({ mentorId: String(ids.lecturer), topic: 'Synthetic rollback', message: 'Private mentoring context for rollback test.' });
    expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('driver details'); expect(await Mentorship.countDocuments()).toBe(0); expect(await MentorshipEvent.countDocuments()).toBe(0);
  });
  it('rolls back an accepted reschedule if its notification cannot be saved', async () => {
    const row = await booked(); const proposed = (await act(row, 'schedule', ids.student, slot(60, 120))).body.data.session;
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Synthetic transactional failure.'));
    expect((await act(proposed, 'schedule/accept')).status).toBe(503);
    const saved = await Mentorship.findById(row._id); expect(saved?.appointment?.startAt.toISOString()).toBe(at(0)); expect(saved?.revision).toBe(5); expect(saved?.proposal).toBeDefined(); expect(await MentorshipEvent.countDocuments()).toBe(5);
  });
});

describe('concurrent calendar capacity and private notifications', () => {
  beforeEach(() => enable());
  it('allows only one of concurrent overlapping bookings for a mentor', async () => {
    const a = await approved(); const b = await approved(ids.outsider);
    const pa = (await act(a, 'schedule', ids.lecturer, slot())).body.data.session; const pb = (await act(b, 'schedule', ids.lecturer, slot(30, 90))).body.data.session;
    const results = await Promise.all([act(pa, 'schedule/accept', ids.student), act(pb, 'schedule/accept', ids.outsider)]); expect(results.map(row => row.status).sort()).toEqual([200, 409]); expect(await Mentorship.countDocuments({ status: 'scheduled' })).toBe(1);
  });
  it('allows only one of concurrent overlapping bookings for a student with different mentors', async () => {
    await enable(ids.alumni); const a = await approved(); const b = await approved(ids.student, ids.alumni);
    const pa = (await act(a, 'schedule', ids.lecturer, slot())).body.data.session; const pb = (await act(b, 'schedule', ids.alumni, slot(30, 90))).body.data.session;
    const results = await Promise.all([act(pa, 'schedule/accept', ids.student), act(pb, 'schedule/accept', ids.student)]); expect(results.map(row => row.status).sort()).toEqual([200, 409]); expect(await Mentorship.countDocuments({ status: 'scheduled' })).toBe(1);
  });
  it('allows adjacent appointments and releases capacity on cancellation', async () => {
    const first = await booked(); await booked(ids.outsider, ids.lecturer, 60, 120); expect(await Mentorship.countDocuments({ status: 'scheduled' })).toBe(2);
    expect((await act(first, 'cancel', ids.student, { reason: 'Release my appointment.' })).status).toBe(200);
    const replacement = await booked(); expect(replacement.appointment).toEqual(slot());
  });
  it('keeps the original booking if a reschedule acceptance loses a calendar race', async () => {
    const first = await booked(); const proposal = (await act(first, 'schedule', ids.student, slot(60, 120))).body.data.session;
    await booked(ids.outsider, ids.lecturer, 60, 120); expect((await act(proposal, 'schedule/accept')).status).toBe(409);
    expect((await Mentorship.findById(first._id))?.appointment?.startAt.toISOString()).toBe(at(0));
  });
  it('returns free availability without booking identities, messages or private subjects', async () => {
    await booked(); const response = await api('get', `/mentors/${ids.lecturer}/availability`, ids.outsider); expect(response.status).toBe(200); expect(response.body.data.windows).toEqual([slot(60, 240)]);
    expect(JSON.stringify(response.body)).not.toMatch(/studentId|Private student|Synthetic mentoring topic|proposal|documentId/);
  });
  it('delivers canonical opposite-party notifications without private student or decision text', async () => {
    await booked(); await runNotificationBatch(100);
    const notices = await Notification.find({ kind: 'mentorship' }); expect(notices).toHaveLength(4); expect(notices.filter(row => row.ownerId.equals(ids.student))).toHaveLength(2);
    expect(JSON.stringify(notices)).not.toMatch(/Private student|Synthetic mentoring topic|TypeScript/);
  });
  it('deduplicates both participants’ reminders for the exact scheduled time', async () => {
    await booked(); await NotificationOutbox.deleteMany({});
    await enqueueNotificationReminders(); await enqueueNotificationReminders(); expect(await NotificationOutbox.countDocuments({ action: 'due' })).toBe(2);
    expect((await runNotificationBatch(100)).delivered).toBe(2); expect(await Notification.countDocuments({ kind: 'mentorship' })).toBe(2);
  });
  it('advances a bounded reminder scan over nondue rows and never reminds after a session starts', async () => {
    await booked(); await NotificationOutbox.deleteMany({});
    await Mentorship.insertMany([1, 2].map(index => ({ _id: new Types.ObjectId(`00000000000000000000010${index}`), mentorId: new Types.ObjectId(), studentId: new Types.ObjectId(), topic: 'Synthetic future booking', message: 'Synthetic rows for bounded reminder scanning.', status: 'scheduled', revision: 1, appointment: { startAt: new Date(base.getTime() + 48 * 3600_000), endAt: new Date(base.getTime() + 49 * 3600_000) } })));
    for (let scan = 0; scan < 4; scan++) await enqueueNotificationReminders(1);
    expect(await NotificationOutbox.countDocuments({ action: 'due' })).toBe(2);
    await NotificationOutbox.deleteMany({}); await enqueueNotificationReminders(100, new Date(base.getTime() + 1)); expect(await NotificationOutbox.countDocuments({ action: 'due' })).toBe(0);
  });
  it('suppresses queued reminders after cancellation without losing session history', async () => {
    const row = await booked(); await NotificationOutbox.deleteMany({}); await enqueueNotificationReminders();
    await act(row, 'cancel', ids.student, { reason: 'Cancel before reminder delivery.' }); await runNotificationBatch(100);
    expect(await Notification.countDocuments({ action: 'due' })).toBe(0); expect(await NotificationOutbox.countDocuments({ action: 'due', status: 'suppressed', outcome: 'stale_source' })).toBe(2); expect(await MentorshipEvent.countDocuments()).toBe(5);
  });
  it('suppresses reminders for the old time and produces reminders for the accepted new time', async () => {
    const row = await booked(); await NotificationOutbox.deleteMany({}); await enqueueNotificationReminders();
    const proposed = (await act(row, 'schedule', ids.student, slot(60, 120))).body.data.session; await act(proposed, 'schedule/accept');
    await enqueueNotificationReminders(); await runNotificationBatch(100); expect(await NotificationOutbox.countDocuments({ action: 'due', status: 'suppressed' })).toBe(2); expect(await Notification.countDocuments({ action: 'due' })).toBe(2);
  });
  it('honors notification preferences and fresh mentor consent when delivering reminders', async () => {
    await booked(); await NotificationOutbox.deleteMany({}); await enqueueNotificationReminders();
    expect((await request(app).put('/api/notifications/preferences').auth(token(ids.student), { type: 'bearer' }).send({ ...defaultNotificationPreferences(), revision: 0, categories: { ...defaultNotificationPreferences().categories, mentorship: false } })).status).toBe(200);
    await CommunityClaim.updateOne({ providerId: ids.lecturer }, { 'profile.visibility': 'hidden' }); await runNotificationBatch(100);
    expect(await Notification.countDocuments({ action: 'due' })).toBe(0); expect(await NotificationOutbox.countDocuments({ action: 'due', status: 'suppressed' })).toBe(2);
  });
});
