import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import { CampusEvent, CampusEventAudit, CampusOrganizer, EventRegistration } from '../../src/models/CampusEvent';
import { VerificationDocument } from '../../src/models/ProviderVerification';
import Notification, { NotificationPreferences, NotificationProducer } from '../../src/models/Notification';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { cancelEventRegistration, changeCampusEvent, recordEventAttendance, registerForEvent } from '../../src/services/campusEvents';
import { enqueueCampusEventWork } from '../../src/services/campusEventNotifications';
import { enqueueNotificationReminders } from '../../src/services/notificationReminders';
import { runNotificationBatch } from '../../src/services/notificationDelivery';
import { defaultNotificationPreferences } from '../../src/services/notificationPolicy';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const base = new Date(Date.now() + 6 * 3600000); const at = (minutes: number) => new Date(base.getTime() + minutes * 60000);
const token = (id: Types.ObjectId) => generateToken(String(id), id.equals(ids.admin) ? 'admin' : id.equals(ids.provider) ? 'provider' : 'student');
const api = (method: 'get' | 'post' | 'put' | 'patch', path = '', id = ids.student) => request(app)[method](`/api/events${path}`).auth(token(id), { type: 'bearer' });
const publicGet = (path = '') => request(app).get(`/api/events${path}`);
const payload = (changes = {}) => ({ title: 'Synthetic campus workshop', description: 'Synthetic event details for isolated automated API tests.', category: 'workshop', mode: 'hybrid', venue: 'Public test campus venue', joinInstructions: 'Private ticket joining code 123456', startsAt: at(0).toISOString(), endsAt: at(120).toISOString(), registrationClosesAt: at(-60).toISOString(), capacity: 2, ...changes });
const approval = (changes = {}) => ({ revision: 0, status: 'approved', institution: 'Test University', identityConfirmed: true, affiliationConfirmed: true, affiliationReference: 'Synthetic independently reviewed identity and campus evidence.', reason: 'Independent identity and university affiliation review.', ...changes });
const decide = (changes = {}, owner = ids.lecturer, actor = ids.admin) => api('put', `/admin/organizers/${owner}`, actor).send(approval(changes));
async function approve(owner = ids.lecturer, changes = {}) { const r = await decide(changes, owner); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body.data.organizer; }
type Row = { _id: string; revision: number; status: string };
async function draft(changes = {}, owner = ids.lecturer) { const r = await api('post', '', owner).send(payload(changes)); expect(r.status, JSON.stringify(r.body)).toBe(201); return r.body.data.event as Row; }
const act = (row: Row, action: string, changes = {}, actor = ids.lecturer) => api('post', `/${row._id}/${action}`, actor).send({ revision: row.revision, ...changes });
async function published(changes = {}, owner = ids.lecturer) { await approve(owner); const row = await draft(changes, owner); const r = await act(row, 'publish', {}, owner); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body.data.event as Row; }
async function join(event: Row, student = ids.student) { const r = await api('post', `/${event._id}/registrations`, student).send({}); expect(r.status, JSON.stringify(r.body)).toBe(201); return r.body.data.registration as Row; }
const closeTicket = (row: Row, actor = ids.student, changes = {}) => api('post', `/registrations/${row._id}/cancel`, actor).send({ revision: row.revision, ...changes });
const attend = (row: Row, actor = ids.lecturer, changes = {}) => api('patch', `/registrations/${row._id}/attendance`, actor).send({ revision: row.revision, attendance: 'attended', reason: 'Organizer explicitly checked attendance at the event.', ...changes });
const drain = () => runNotificationBatch(100, new Date());
beforeAll(() => database.start());
beforeEach(async () => {
  await database.clear();
  await User.create([adminFixture(), studentFixture(), studentFixture({ _id: ids.outsider, email: 'peer@example.test' }), studentFixture({ _id: ids.lecturer, email: 'organizer@example.test', fullName: 'Synthetic Campus Organizer' }), providerFixture()]);
});
afterAll(() => database.stop());

describe('campus organizer approval and session boundaries', () => {
  it('allows anonymous discovery but requires normal full sessions for private activity', async () => {
    expect((await publicGet()).status).toBe(200); expect((await publicGet('/mine')).status).toBe(401);
    expect((await request(app).get('/api/events/organizer').auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await api('get', '/registrations/mine')).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: false, accountStatus: 'suspended' }); expect((await api('get', '/organizer')).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'active', tokenVersion: 1 }); expect((await api('get', '/organizer')).status).toBe(401);
  });
  it('requires separate independent approval even for a verified provider', async () => {
    expect((await api('post', '', ids.lecturer).send(payload())).status).toBe(403); expect((await api('post', '', ids.provider).send(payload())).status).toBe(403);
    expect((await decide({}, ids.lecturer, ids.student)).status).toBe(403); expect((await decide({}, ids.admin)).status).toBe(400);
    expect((await api('get', '/admin/organizers')).status).toBe(403);
  });
  it.each([{ identityConfirmed: false }, { affiliationConfirmed: false }, { affiliationReference: 'too short' }, { reason: 'short' }, { revision: '0' }, { role: 'admin' }, { institution: 'Different University' }])('rejects unsupported or unreviewed approvals %j', async changes => { expect((await decide(changes)).status).toBeGreaterThanOrEqual(400); expect(await CampusOrganizer.countDocuments()).toBe(0); });
  it('binds student approval to current identity without changing account roles', async () => {
    const grant = await approve(); expect(grant.revision).toBe(1); expect((await User.findById(ids.lecturer))?.role).toBe('student');
    expect((await api('get', '/organizer', ids.lecturer)).body.data).toMatchObject({ eligible: true, organizer: { institution: 'Test University', revision: 1 } });
    expect((await AuditLog.findOne())?.action).toBe('campus_organizer_approved'); expect(await CampusEventAudit.countDocuments({ scope: 'organizer' })).toBe(1); expect(await NotificationOutbox.countDocuments()).toBe(1);
    const queue = await api('get', '/admin/organizers?status=approved', ids.admin); expect(queue.body.data.total).toBe(1); expect(queue.body.data.organizers[0]).toHaveProperty('affiliationReference');
    const own = await api('get', '/organizer', ids.lecturer); expect(own.body.data.organizer).not.toHaveProperty('affiliationReference'); expect(own.body.data.organizer).not.toHaveProperty('identity'); expect(JSON.stringify(own.body)).not.toContain('organizer@example'); expect(own.headers['cache-control']).toBe('no-store');
    expect((await api('get', `/admin/organizers/${ids.lecturer}/history`, ids.admin)).body.data.total).toBe(1);
  });
  it('requires current provider evidence actually reviewed by the deciding administrator', async () => {
    expect((await decide({}, ids.provider)).status).toBe(409); const documentId = new Types.ObjectId();
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationDocumentId': documentId });
    await VerificationDocument.create({ _id: documentId, providerId: ids.provider, fileName: 'synthetic.pdf', contentType: 'application/pdf', size: 20, data: Buffer.from('%PDF-synthetic-test'), sha256: 'synthetic-hash' });
    expect((await decide({}, ids.provider)).status).toBe(409);
    expect((await request(app).get(`/api/admin/providers/${ids.provider}/documents/${documentId}`).auth(token(ids.admin), { type: 'bearer' })).status).toBe(200);
    await approve(ids.provider); const row = await draft({}, ids.provider); expect((await act(row, 'publish', {}, ids.provider)).status).toBe(200); expect((await publicGet()).body.data.total).toBe(1);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationDocumentId': new Types.ObjectId() }); expect((await publicGet()).body.data.total).toBe(0);
  });
  it('serializes concurrent approval decisions using the expected revision', async () => {
    const results = await Promise.all([decide(), decide()]); expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect(await CampusEventAudit.countDocuments({ scope: 'organizer' })).toBe(1);
  });
  it('rolls back approval, both audit trails and notices when outbox persistence fails', async () => {
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('private database details'));
    const r = await decide(); expect(r.status).toBe(503); expect(JSON.stringify(r.body)).not.toContain('private database'); expect(await CampusOrganizer.countDocuments()).toBe(0); expect(await CampusEventAudit.countDocuments()).toBe(0); expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe('drafts, public event discovery and publication authority', () => {
  it('keeps drafts private and publishes safe public metadata anonymously', async () => {
    await approve(); const row = await draft({ joinInstructions: '  Private ticket joining code 123456  ' });
    expect((await api('get', `/mine/${row._id}`, ids.lecturer)).body.data.event.joinInstructions).toBe('Private ticket joining code 123456');
    expect((await publicGet()).body.data.total).toBe(0); expect((await publicGet(`/${row._id}`)).status).toBe(404);
    expect((await act(row, 'publish')).status).toBe(200); const r = await publicGet(`/${row._id}`); expect(r.status).toBe(200); expect(r.headers['cache-control']).toBe('no-store'); expect(r.body.data.event).toMatchObject({ status: 'published', capacity: 2, registeredCount: 0, institution: 'Test University' });
    for (const value of ['joinInstructions', '123456', 'identity', 'affiliationReference', 'email', 'noticeRevision', 'grantRevision']) expect(JSON.stringify(r.body)).not.toContain(value);
    expect((await api('get', '/admin', ids.admin)).body.data.events[0]).not.toHaveProperty('joinInstructions');
  });
  it('supports category, institution, mode, literal search and pagination without private data', async () => {
    await published({ title: 'Workshop .* (literal)' }); await act(await draft({ category: 'hackathon', title: 'Second event' }), 'publish');
    expect((await publicGet('?category=hackathon')).body.data.total).toBe(1); expect((await publicGet('?q=.*')).body.data.total).toBe(1); expect((await publicGet('?institution=test&mode=hybrid')).body.data.total).toBe(2);
    const first = (await publicGet('?limit=1')).body.data; const second = (await publicGet('?limit=1&page=2')).body.data; expect(first.total).toBe(2); expect(first.events[0]._id).not.toBe(second.events[0]._id);
  });
  it.each(['?page=0', '?limit=101', '?q[$ne]=x', '?status=draft', '?category=invalid', '?mode=private', '?phase=future', '?page=1.2'])('rejects unsupported public filters %s', async suffix => expect((await publicGet(suffix)).status).toBe(400));
  it('prevents ownership spoofing and peer/admin event modification', async () => {
    await approve(); expect((await api('post', '', ids.lecturer).send(payload({ organizerId: String(ids.provider) }))).status).toBe(400);
    const row = await draft(); expect((await act(row, 'publish', {}, ids.student)).status).toBe(404); expect((await act(row, 'publish', {}, ids.admin)).status).toBe(403);
    expect((await api('get', `/mine/${row._id}`, ids.student)).status).toBe(404); expect((await api('get', `/mine/${row._id}/history`, ids.student)).status).toBe(404);
  });
  it('requires reasons for published changes and rejects stale revisions', async () => {
    const row = await published(); expect((await api('patch', `/${row._id}`, ids.lecturer).send({ revision: row.revision, title: 'Updated title' })).status).toBe(400);
    const changed = await api('patch', `/${row._id}`, ids.lecturer).send({ revision: row.revision, title: 'Updated title', reason: 'The organizer corrected the event title.' }); expect(changed.status).toBe(200);
    expect((await act(row, 'cancel', { reason: 'The organizer cancelled the event.' })).status).toBe(409);
    expect((await api('get', `/mine/${row._id}/history`, ids.lecturer)).body.data.total).toBe(3);
  });
  it.each(['fullName', 'email', 'studentProfile.institution', 'accountStatus'])('withdraws public authority after %s changes', async field => {
    const row = await published(); const value = field === 'accountStatus' ? 'suspended' : field === 'email' ? 'changed@example.test' : 'Unreviewed identity'; await User.updateOne({ _id: ids.lecturer }, { [field]: value });
    expect((await publicGet()).body.data.total).toBe(0); expect((await publicGet(`/${row._id}`)).status).toBe(404); expect((await api('post', `/${row._id}/registrations`).send({})).status).toBe(404);
  });
  it('requires explicit republication after revocation and renewed approval', async () => {
    const row = await published(); await join(row); expect((await decide({ revision: 1, status: 'revoked' })).status).toBe(200); expect((await publicGet()).body.data.total).toBe(0);
    expect((await api('get', `/${row._id}/registrations`, ids.lecturer)).status).toBe(403); expect((await api('get', '/registrations/mine')).body.data.registrations[0]).not.toHaveProperty('joinInstructions');
    await approve(ids.lecturer, { revision: 2 }); expect((await publicGet()).body.data.total).toBe(0);
    expect((await api('patch', `/${row._id}`, ids.lecturer).send({ revision: row.revision, title: 'Changed title', reason: 'Changed after renewed approval.' })).status).toBe(409);
    const renewed = await act(row, 'publish', { reason: 'Explicitly reviewed event under renewed approval.' }); expect(renewed.status).toBe(200); expect((await publicGet()).body.data.total).toBe(1);
  });
  it('lets a revoked organizer close existing events and administrators cancel safely', async () => {
    const row = await published(); await decide({ revision: 1, status: 'revoked' }); const r = await act(row, 'cancel', { reason: 'The organizer must withdraw this event.' }); expect(r.status).toBe(200);
    expect((await act(row, 'cancel', { reason: 'Retry cancellation of the same event.' })).status).toBe(200); expect(await CampusEventAudit.countDocuments({ action: 'cancelled' })).toBe(1);
    await approve(ids.lecturer, { revision: 2 }); const another = await draft(); expect((await api('post', `/admin/${another._id}/cancel`, ids.admin).send({ revision: another.revision, reason: 'Administrator closed an inappropriate draft.' })).status).toBe(200);
    expect((await act(r.body.data.event, 'publish')).status).toBe(409);
  });
  it('enforces organizer creation and mutation quotas without partial records', async () => {
    await approve(); const existing = await draft(); const docs = Array.from({ length: 9 }, () => ({ scope: 'event', targetId: new Types.ObjectId(), actorId: ids.lecturer, revision: 0, action: 'created', reason: 'Synthetic quota fixture.' })); await CampusEventAudit.insertMany(docs);
    expect((await api('post', '', ids.lecturer).send(payload())).status).toBe(429); expect(await CampusEvent.countDocuments()).toBe(1);
    await CampusEventAudit.insertMany(Array.from({ length: 50 }, () => ({ scope: 'event', targetId: new Types.ObjectId(), actorId: ids.lecturer, revision: 1, action: 'updated', reason: 'Synthetic mutation quota.' })));
    expect((await act(existing, 'publish')).status).toBe(429); expect((await CampusEvent.findById(existing._id))?.status).toBe('draft');
  });
});

describe('transactional registration, cancellation and capacity', () => {
  it('registers once, exposes only owned tickets and minimizes organizer roster data', async () => {
    const event = await published(); const row = await join(event);
    expect((await api('get', `/registrations/${row._id}`)).body.data).toMatchObject({ registration: { attendance: 'unmarked', status: 'registered' }, eventAvailable: true, joinInstructions: 'Private ticket joining code 123456' });
    expect((await api('get', `/registrations/${row._id}`, ids.outsider)).status).toBe(404); expect((await api('get', `/registrations/${row._id}`, ids.admin)).status).toBe(403);
    expect((await api('get', `/${event._id}/registrations`, ids.outsider)).status).toBe(404); expect((await api('get', `/registrations/${row._id}/history`, ids.outsider)).status).toBe(404);
    const roster = await api('get', `/${event._id}/registrations`, ids.lecturer); expect(roster.status).toBe(200); expect(roster.body.data.registrations[0].studentId).toMatchObject({ fullName: 'Synthetic Student', studentProfile: { institution: 'Test University' } }); expect(JSON.stringify(roster.body)).not.toMatch(/email|lastEventNotice|lastGrantNotice/);
    expect((await api('get', '/registrations/mine')).body.data.total).toBe(1); expect((await api('get', `/registrations/${row._id}/history`)).body.data.total).toBe(1);
  });
  it('has exactly one winner for concurrent final-seat requests', async () => {
    const event = await published({ capacity: 1 }); const results = await Promise.all([api('post', `/${event._id}/registrations`, ids.student).send({}), api('post', `/${event._id}/registrations`, ids.outsider).send({})]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]); expect(await EventRegistration.countDocuments({ status: 'registered' })).toBe(1); expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(1); expect(await CampusEventAudit.countDocuments({ action: 'registered' })).toBe(1);
  });
  it('serializes duplicate requests without double counting', async () => {
    const event = await published(); const results = await Promise.all([api('post', `/${event._id}/registrations`).send({}), api('post', `/${event._id}/registrations`).send({})]); expect(results.map(r => r.status).sort()).toEqual([201, 409]); expect(await EventRegistration.countDocuments()).toBe(1); expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(1);
  });
  it('releases capacity once, preserves history and reuses the cancelled ticket on re-registration', async () => {
    const event = await published({ capacity: 1 }); const row = await join(event); expect((await closeTicket(row)).status).toBe(200); expect((await closeTicket(row)).status).toBe(200);
    expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(0); expect((await api('get', `/registrations/${row._id}`)).body.data).not.toHaveProperty('joinInstructions');
    const next = await join(event); expect(next._id).toBe(row._id); expect(next.revision).toBe(2); expect(await EventRegistration.countDocuments()).toBe(1); expect((await closeTicket(row)).status).toBe(409); expect((await api('get', `/registrations/${row._id}/history`)).body.data.total).toBe(3);
  });
  it('prevents below-count capacity changes and concurrent oversubscription during capacity reduction', async () => {
    const event = await published({ capacity: 2 }); await join(event);
    const results = await Promise.all([api('patch', `/${event._id}`, ids.lecturer).send({ revision: event.revision, capacity: 1, reason: 'The room capacity changed after review.' }), api('post', `/${event._id}/registrations`, ids.outsider).send({})]);
    expect(results.every(r => [200, 201, 409].includes(r.status))).toBe(true); const actual = (await CampusEvent.findById(event._id))!; expect(actual.registeredCount).toBeLessThanOrEqual(actual.capacity); expect(actual.registeredCount).toBe(await EventRegistration.countDocuments({ status: 'registered' }));
    if (actual.registeredCount === 2) expect((await api('patch', `/${event._id}`, ids.lecturer).send({ revision: actual.revision, capacity: 1, reason: 'Another room capacity reduction attempt.' })).status).toBe(409);
  });
  it('enforces source publication, deadline equality, student role and organizer exclusion', async () => {
    const event = await published(); expect((await api('post', `/${event._id}/registrations`, ids.provider).send({})).status).toBe(403); expect((await api('post', `/${event._id}/registrations`, ids.lecturer).send({})).status).toBe(403);
    expect((await api('post', `/${event._id}/registrations`).send({ studentId: String(ids.outsider) })).status).toBe(400);
    await expect(registerForEvent(ids.student, event._id, {}, at(-60))).rejects.toMatchObject({ statusCode: 409 });
    await act(event, 'cancel', { reason: 'This event is withdrawn before registrations.' }); expect((await api('post', `/${event._id}/registrations`).send({})).status).toBe(404);
  });
  it('rejects peer cancellation and cancellation at event start', async () => {
    const event = await published(); const row = await join(event); expect((await closeTicket(row, ids.outsider)).status).toBe(404); await expect(cancelEventRegistration(ids.student, row._id, { revision: row.revision }, at(0))).rejects.toMatchObject({ statusCode: 409 });
    expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(1);
  });
  it('retains cancelled-event tickets and permits release without losing history', async () => {
    const event = await published(); const row = await join(event); await act(event, 'cancel', { reason: 'Campus administration cancelled this event.' });
    const detail = (await api('get', `/registrations/${row._id}`)).body.data; expect(detail.effectiveStatus).toBe('event_cancelled'); expect(detail).not.toHaveProperty('joinInstructions'); expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(1);
    await cancelEventRegistration(ids.student, row._id, { revision: row.revision }, at(60)); expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(0); expect((await EventRegistration.findById(row._id))?.status).toBe('cancelled');
  });
  it.each(['register', 'cancel'])('rolls back inventory, registration and audit when %s notifications fail', async action => {
    const event = await published(); const row = action === 'cancel' ? await join(event) : null; const before = await CampusEventAudit.countDocuments();
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Sensitive database failure'));
    const r = row ? await closeTicket(row) : await api('post', `/${event._id}/registrations`).send({}); expect(r.status).toBe(503); expect(JSON.stringify(r.body)).not.toContain('Sensitive');
    expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(row ? 1 : 0); expect(await CampusEventAudit.countDocuments()).toBe(before); expect(await EventRegistration.countDocuments({ status: 'registered' })).toBe(row ? 1 : 0);
  });
  it('rate limits registration churn without altering inventory', async () => {
    const event = await published(); await CampusEventAudit.insertMany(Array.from({ length: 20 }, () => ({ scope: 'registration', targetId: new Types.ObjectId(), eventId: event._id, actorId: ids.student, revision: 0, action: 'registered', reason: 'Synthetic registration quota fixture.' })));
    expect((await api('post', `/${event._id}/registrations`).send({})).status).toBe(429); expect((await CampusEvent.findById(event._id))?.registeredCount).toBe(0); expect(await EventRegistration.countDocuments()).toBe(0);
  });
});

describe('explicit organizer-recorded attendance', () => {
  async function ongoing() { const event = await published(); const row = await join(event); await CampusEvent.updateOne({ _id: event._id }, { startsAt: new Date(Date.now() - 60000) }); return { event, row }; }
  it('requires the actual approved organizer, start time and an explicit reason', async () => {
    const event = await published(); const row = await join(event); expect((await attend(row)).status).toBe(409); expect((await attend(row, ids.student)).status).toBe(404); expect((await attend(row, ids.admin)).status).toBe(403);
    await CampusEvent.updateOne({ _id: event._id }, { startsAt: new Date(Date.now() - 60000) }); expect((await attend(row, ids.lecturer, { reason: undefined })).status).toBe(400); expect((await attend(row, ids.lecturer, { attendance: 'unmarked' })).status).toBe(400);
    expect((await attend(row)).status).toBe(200); expect((await EventRegistration.findById(row._id))?.attendanceActorId).toEqual(ids.lecturer); expect((await closeTicket({ ...row, revision: 1 })).status).toBe(409);
  });
  it('records corrections with real actors and rejects stale attendance revisions', async () => {
    const { row } = await ongoing(); const r = await attend(row); expect(r.status).toBe(200); expect((await attend(row, ids.lecturer, { attendance: 'absent' })).status).toBe(409);
    expect((await attend(r.body.data.registration, ids.lecturer, { attendance: 'absent', reason: 'Organizer corrected an incorrect attendance observation.' })).status).toBe(200);
    const history = await api('get', `/registrations/${row._id}/history`); expect(history.body.data.events.map((e: { action: string }) => e.action)).toEqual(['attendance', 'attendance', 'registered']); expect(history.body.data.events[0].actorId).toBe(String(ids.lecturer));
  });
  it('completes events after end without inventing attendance and supports bounded late records', async () => {
    const event = await published(); const row = await join(event); expect((await act(event, 'complete')).status).toBe(409);
    await CampusEvent.updateOne({ _id: event._id }, { startsAt: new Date(Date.now() - 120000), endsAt: new Date(Date.now() - 60000) }); expect((await act(event, 'complete')).status).toBe(200);
    expect((await EventRegistration.findById(row._id))?.attendance).toBe('unmarked'); expect((await attend(row)).status).toBe(200);
    await expect(recordEventAttendance(ids.lecturer, row._id, { revision: 1, attendance: 'absent', reason: 'Late correction beyond the policy boundary.' }, at(8 * 24 * 60))).rejects.toMatchObject({ statusCode: 409 });
    expect((await publicGet('?phase=past')).body.data.total).toBe(1);
  });
  it('rejects cancelled tickets, cancelled events and revoked organizer authority', async () => {
    const { event, row } = await ongoing(); await decide({ revision: 1, status: 'revoked' }); expect((await attend(row)).status).toBe(403);
    await approve(ids.lecturer, { revision: 2 }); await act(event, 'cancel', { reason: 'Cancel before any attendance records are made.' }); expect((await attend(row)).status).toBe(409);
  });
  it('rolls back attendance and history if its notice cannot be persisted', async () => {
    const { row } = await ongoing(); vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Sensitive outbox failure')); expect((await attend(row)).status).toBe(503); expect((await EventRegistration.findById(row._id))?.attendance).toBe('unmarked'); expect(await CampusEventAudit.countDocuments({ action: 'attendance' })).toBe(0);
  });
});

describe('bounded reminder fanout, stale-source protection and preference compatibility', () => {
  async function ready() { const event = await published(); const row = await join(event); await NotificationOutbox.deleteMany({}); return { event, row }; }
  it('deduplicates reminders and delivers canonical in-app text without joining data', async () => {
    const { row } = await ready(); expect(await enqueueCampusEventWork()).toEqual({ scanned: 1, considered: 1, updates: 0 }); await enqueueCampusEventWork(); expect(await NotificationOutbox.countDocuments()).toBe(1); expect((await drain()).delivered).toBe(1);
    const n = await Notification.findOne(); expect(n?.sourceId).toEqual(new Types.ObjectId(row._id)); expect(n?.title).toBe('Campus event reminder'); expect(JSON.stringify(n)).not.toMatch(/123456|Synthetic campus|organizer@example/);
  });
  it('advances a bounded rotating cursor over nondue registrations', async () => {
    const event = await published({ startsAt: at(3000).toISOString(), endsAt: at(3120).toISOString() }); await join(event); await join(event, ids.outsider); await NotificationOutbox.deleteMany({});
    expect((await enqueueCampusEventWork(1)).scanned).toBe(1); const first = (await NotificationProducer.findOne({ key: 'campus-event-registrations' }))?.afterId;
    expect((await enqueueCampusEventWork(1)).scanned).toBe(1); const second = (await NotificationProducer.findOne({ key: 'campus-event-registrations' }))?.afterId; expect(String(second)).not.toBe(String(first));
    await enqueueCampusEventWork(1); expect(String((await NotificationProducer.findOne({ key: 'campus-event-registrations' }))?.afterId)).toBe(String(first)); expect(await NotificationOutbox.countDocuments()).toBe(0);
    expect((await enqueueNotificationReminders(1)).campusEvents.scanned).toBe(1); expect(await NotificationProducer.countDocuments()).toBe(5);
  });
  it.each(['cancel_ticket', 'cancel_event', 'reschedule', 'revoke', 'suspend', 'change_identity', 'delete_source'])('suppresses a stale queued reminder after %s', async scenario => {
    const { event, row } = await ready(); await enqueueCampusEventWork();
    if (scenario === 'cancel_ticket') await closeTicket(row);
    if (scenario === 'cancel_event') await act(event, 'cancel', { reason: 'Withdraw the campus event before reminder delivery.' });
    if (scenario === 'reschedule') await api('patch', `/${event._id}`, ids.lecturer).send({ revision: event.revision, startsAt: at(30).toISOString(), reason: 'The organizer rescheduled the start time.' });
    if (scenario === 'revoke') await decide({ revision: 1, status: 'revoked' });
    if (scenario === 'suspend') await User.updateOne({ _id: ids.lecturer }, { accountStatus: 'suspended' });
    if (scenario === 'change_identity') await User.updateOne({ _id: ids.lecturer }, { fullName: 'Unreviewed changed identity' });
    if (scenario === 'delete_source') await EventRegistration.deleteMany({});
    await drain(); expect(await Notification.countDocuments({ action: 'due' })).toBe(0); expect((await NotificationOutbox.findOne({ action: 'due' }))?.outcome).toBe('stale_source');
  });
  it('invalidates old approval-version reminders and queues a new one after explicit republication', async () => {
    const { event } = await ready(); await enqueueCampusEventWork(); await decide({ revision: 1, status: 'revoked' }); await approve(ids.lecturer, { revision: 2 }); const r = await act(event, 'publish', { reason: 'Republish after independent renewed approval.' }); expect(r.status).toBe(200);
    await drain(); expect(await Notification.countDocuments({ action: 'due' })).toBe(0); await enqueueCampusEventWork(); await drain(); expect(await Notification.countDocuments({ action: 'due' })).toBe(1);
  });
  it('fans out cancellation and approval changes without altering ticket revisions or history', async () => {
    const { event, row } = await ready(); await act(event, 'cancel', { reason: 'Event cancelled due to campus venue availability.' }); expect((await enqueueCampusEventWork()).updates).toBe(1); expect((await enqueueCampusEventWork()).updates).toBe(0);
    await drain(); expect(await Notification.countDocuments({ kind: 'event', action: 'updated' })).toBe(1); expect((await EventRegistration.findById(row._id))?.revision).toBe(0); expect(await CampusEventAudit.countDocuments({ scope: 'registration' })).toBe(1);
    await decide({ revision: 1, status: 'revoked' }); expect((await enqueueCampusEventWork()).updates).toBe(1); await drain(); expect(await Notification.countDocuments({ kind: 'event', action: 'updated' })).toBe(2);
  });
  it('suppresses reminders to nonowners and unregistered recipients even for malformed internal jobs', async () => {
    const { row } = await ready(); await enqueueCampusEventWork(); await NotificationOutbox.updateOne({ sourceId: row._id }, { ownerId: ids.outsider }); await drain(); expect(await Notification.countDocuments()).toBe(0);
  });
  it('preserves event opt-out when an older seven-category client updates preferences', async () => {
    await ready(); const preferences = defaultNotificationPreferences(); preferences.categories.event = false;
    const update = (body: object) => request(app).put('/api/notifications/preferences').auth(token(ids.student), { type: 'bearer' }).send(body);
    expect((await update({ ...preferences, revision: 0 })).status).toBe(200); const { event: _event, ...legacy } = defaultNotificationPreferences().categories;
    const r = await update({ inApp: true, revision: 1, categories: legacy }); expect(r.status).toBe(200); expect(r.body.data.preferences.categories.event).toBe(false);
    await enqueueCampusEventWork(); await drain(); expect(await Notification.countDocuments()).toBe(0); expect((await NotificationOutbox.findOne())?.outcome).toBe('preferences');
  });
  it('defaults legacy persisted preferences to event=true without a migration', async () => {
    const { event: _event, ...legacy } = defaultNotificationPreferences().categories;
    await NotificationPreferences.collection.insertOne({ ownerId: ids.student, revision: 2, inApp: true, categories: legacy });
    const r = await request(app).get('/api/notifications/preferences').auth(token(ids.student), { type: 'bearer' }); expect(r.status).toBe(200); expect(r.body.data.preferences.categories.event).toBe(true);
    expect((await NotificationPreferences.collection.findOne({ ownerId: ids.student }))?.categories).not.toHaveProperty('event');
  });
});
