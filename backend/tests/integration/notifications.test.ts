import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import Notification, { NotificationPreferences, NotificationProducer } from '../../src/models/Notification';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import User from '../../src/models/User';
import Application from '../../src/models/Application';
import Opportunity from '../../src/models/Opportunity';
import Resource from '../../src/models/Resource';
import ResourceRequest from '../../src/models/ResourceRequest';
import { ResourceEvent } from '../../src/models/ResourceActivity';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import MessagingSettings from '../../src/models/MessagingSettings';
import { enqueueDomainNotification, enqueueNotification } from '../../src/services/notifications';
import { claimNotification, deliverClaimedNotification, notificationTransactions, runNotificationBatch } from '../../src/services/notificationDelivery';
import { enqueueNotificationReminders } from '../../src/services/notificationReminders';
import { defaultNotificationPreferences, type NotificationKind } from '../../src/services/notificationPolicy';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, applicationFixture, conversationFixture, ids, providerFixture, resourceFixture, resourceRequestFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase(); const now = new Date('2030-01-01T12:00:00.000Z');
const bearer = (id = ids.student) => `Bearer ${generateToken(String(id), 'student')}`;
const get = (path = '', id = ids.student) => request(app).get(`/api/notifications${path}`).set('Authorization', bearer(id));
const prefs = (values: Record<string, unknown>, id = ids.student) => request(app).put('/api/notifications/preferences').set('Authorization', bearer(id)).send({ ...defaultNotificationPreferences(), revision: 0, ...values });
const mark = (id: string, read: unknown, owner = ids.student) => request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearer(owner)).send({ read });
const queue = (key = 'synthetic-event', owner = ids.student, kind: NotificationKind = 'campaign') => mongoose.connection.transaction(session => enqueueDomainNotification(kind, owner, key, new Types.ObjectId(), session), notificationTransactions);
const drain = () => runNotificationBatch(100, now);
async function message() {
  await Opportunity.create(scholarshipFixture()); await Application.create(applicationFixture()); await Conversation.create(conversationFixture());
  const response = await request(app).post(`/api/messages/conversations/${ids.conversation}/messages`).set('Authorization', bearer()).send({ content: 'Private synthetic message that must never appear in a notification preview.' });
  expect(response.status).toBe(201); return Message.findOne();
}
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); await User.create([studentFixture(), providerFixture(), studentFixture({ _id: ids.outsider, email: 'unrelated@example.test' }), adminFixture()]); });
afterAll(() => database.stop());

describe('own inbox, read state and consent API', () => {
  it('delivers a legacy campaign outbox notice exactly once using safe canonical text', async () => {
    await mongoose.connection.transaction(session => enqueueNotification({ ownerId: String(ids.student), kind: 'campaign', title: 'Private untrusted legacy title', body: 'Private untrusted legacy body', href: '/my-promotion-requests', dedupeKey: 'old-campaign' }, session), notificationTransactions);
    expect((await get()).body.data.notifications).toEqual([]); await drain(); await drain();
    const response = await get(); expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ unread: 1, total: 1 }); expect(response.body.data.notifications[0]).toMatchObject({ kind: 'campaign', href: '/my-promotion-requests' });
    expect(JSON.stringify(response.body)).not.toContain('Private'); expect(response.body.data.notifications[0]).not.toHaveProperty('dedupeKey'); expect(response.headers['cache-control']).toBe('no-store'); expect((await NotificationOutbox.findOne())?.status).toBe('delivered');
  });
  it('counts unread, marks read idempotently, and restores unread without duplicating history', async () => {
    await queue(); await drain(); const id = String((await Notification.findOne())!._id);
    expect((await get('/unread-count')).body.data.unread).toBe(1); expect((await mark(id, true)).status).toBe(200); const first = (await Notification.findById(id))!.readAt;
    await mark(id, true); expect((await Notification.findById(id))!.readAt).toEqual(first); expect((await get('/unread-count')).body.data.unread).toBe(0);
    expect((await get('?unread=true')).body.data.notifications).toEqual([]); expect((await get('?unread=false')).body.data.total).toBe(1);
    await mark(id, false); expect((await get('/unread-count')).body.data.unread).toBe(1); expect(await Notification.countDocuments()).toBe(1);
  });
  it('rejects missing sessions and cross-user/admin inbox mutation', async () => {
    await queue(); await drain(); const id = String((await Notification.findOne())!._id);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    for (const owner of [ids.outsider, ids.admin]) { expect((await get('', owner)).body.data.total).toBe(0); expect((await mark(id, true, owner)).status).toBe(404); }
    expect((await mark('not-an-id', true)).status).toBe(400); expect((await mark(id, 'true')).status).toBe(400);
    expect((await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearer()).send({ read: true, ownerId: String(ids.outsider) })).status).toBe(400);
  });
  it('uses bounded filtering and stable pagination without exposing worker internals', async () => {
    for (let index = 0; index < 5; index++) await queue(`event-${index}`); await queue('resource-update', ids.student, 'resource'); await drain();
    const first = await get('?limit=2&page=1&kind=campaign'); const second = await get('?limit=2&page=2&kind=campaign'); expect(first.body.data.total).toBe(5); expect(first.body.data.notifications).toHaveLength(2);
    expect(first.body.data.notifications.map((row: { _id: string }) => row._id).filter((id: string) => second.body.data.notifications.some((row: { _id: string }) => row._id === id))).toEqual([]);
    for (const query of ['page=0', 'limit=101', 'kind=unknown', 'unread=1', 'kind[$ne]=x']) expect((await get(`?${query}`)).status).toBe(400);
    expect(JSON.stringify(first.body)).not.toMatch(/leaseToken|attempts|outcome|dedupeKey/);
  });
  it('returns defaults without a write and revision-controls preference updates', async () => {
    expect((await get('/preferences')).body.data).toEqual({ preferences: { ...defaultNotificationPreferences(), revision: 0 }, supportedChannels: ['in_app'] }); expect(await NotificationPreferences.countDocuments()).toBe(0);
    expect((await prefs({ inApp: false })).body.data.preferences.revision).toBe(1); expect((await prefs({ inApp: true })).status).toBe(409);
    expect((await prefs({ inApp: true, revision: 1 })).status).toBe(200); expect((await get('/preferences', ids.outsider)).body.data.preferences.revision).toBe(0);
    expect((await prefs({ email: true, revision: 2 })).status).toBe(400);
  });
  it('allows only one of two concurrent consent edits at the same revision', async () => {
    const responses = await Promise.all([prefs({ inApp: false }), prefs({ categories: { ...defaultNotificationPreferences().categories, message: false } })]); expect(responses.map(row => row.status).sort()).toEqual([200, 409]); expect((await NotificationPreferences.findOne())?.revision).toBe(1);
  });
  it('suppresses queued notices after consent withdrawal and does not resurrect them on opt-in', async () => {
    await queue('suppressed'); await prefs({ inApp: false }); expect((await drain()).suppressed).toBe(1); expect(await Notification.countDocuments()).toBe(0);
    expect((await NotificationOutbox.findOne())?.deliveredAt).toBeUndefined(); expect((await NotificationOutbox.findOne())?.processedAt).toEqual(now);
    await prefs({ inApp: true, revision: 1 }); await drain(); expect(await Notification.countDocuments()).toBe(0);
    await queue('new-after-opt-in'); await drain(); expect(await Notification.countDocuments()).toBe(1);
    await prefs({ inApp: false, revision: 2 }); expect((await get()).body.data.total).toBe(1);
  });
  it('respects category preferences while allowing other categories', async () => {
    await prefs({ categories: { ...defaultNotificationPreferences().categories, campaign: false } }); await queue('campaign'); await queue('application', ids.student, 'application'); await drain(); expect((await get()).body.data.notifications.map((row: { kind: string }) => row.kind)).toEqual(['application']);
  });
  it('permits only verification notices for a pending provider restricted session', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'PENDING' });
    await queue('verification', ids.provider, 'verification'); await queue('campaign', ids.provider); await drain();
    const token = generateVerificationToken(String(ids.provider)); const response = await request(app).get('/api/notifications').auth(token, { type: 'bearer' }); expect(response.status).toBe(200); expect(response.body.data.notifications.map((row: { kind: string }) => row.kind)).toEqual(['verification']);
    expect((await request(app).get('/api/notifications?kind=campaign').auth(token, { type: 'bearer' })).status).toBe(403); expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/api/notifications/preferences').auth(token, { type: 'bearer' })).status).toBe(200);
  });
  it('denies suspended, revoked, email-gated and wrongly scoped identities', async () => {
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await get()).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: false, accountStatus: 'suspended' }); expect((await get()).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'active', tokenVersion: 1 }); expect((await get()).status).toBe(401);
    const wrong = generateVerificationToken(String(ids.outsider)); expect((await request(app).get('/api/notifications').auth(wrong, { type: 'bearer' })).status).toBe(403);
  });
  it('keeps a verification-scoped session restricted even after the provider is verified', async () => {
    await queue('own-campaign', ids.provider); await queue('own-verification', ids.provider, 'verification'); await drain();
    const token = generateVerificationToken(String(ids.provider)); const limited = await request(app).get('/api/notifications').auth(token, { type: 'bearer' }); expect(limited.status).toBe(200); expect(limited.body.data.notifications.map((row: { kind: string }) => row.kind)).toEqual(['verification']);
    const campaign = await Notification.findOne({ kind: 'campaign' }); expect((await request(app).patch(`/api/notifications/${campaign!._id}/read`).auth(token, { type: 'bearer' }).send({ read: true })).status).toBe(404);
    expect((await request(app).put('/api/notifications/preferences').auth(token, { type: 'bearer' }).send({ ...defaultNotificationPreferences(), revision: 0, inApp: false })).status).toBe(403); expect(await NotificationPreferences.countDocuments()).toBe(0);
    expect((await get('', ids.provider)).body.data.total).toBe(2);
  });
  it('suppresses nonexistent and suspended recipients rather than creating public or orphan inbox entries', async () => {
    await queue('deleted', new Types.ObjectId()); await queue('suspended', ids.outsider); await User.updateOne({ _id: ids.outsider }, { accountStatus: 'suspended' }); expect((await drain()).suppressed).toBe(2); expect(await Notification.countDocuments()).toBe(0);
  });
});

describe('durable leases, retries and atomic effects', () => {
  it('deduplicates an event at enqueue and under concurrent delivery workers', async () => {
    await queue('same'); await queue('same'); expect(await NotificationOutbox.countDocuments()).toBe(1);
    await Promise.all([runNotificationBatch(10, now), runNotificationBatch(10, now), runNotificationBatch(10, now)]); expect(await Notification.countDocuments()).toBe(1); expect((await NotificationOutbox.findOne())?.attempts).toBe(1);
  });
  it('rolls back failed materialization and retries only after bounded backoff', async () => {
    await queue(); const before = (await User.findById(ids.student))!.__v; vi.spyOn(Notification, 'updateOne').mockRejectedValueOnce(new Error('Private database and recipient information'));
    expect((await drain()).retried).toBe(1); expect(await Notification.countDocuments()).toBe(0); expect((await User.findById(ids.student))!.__v).toBe(before);
    expect((await NotificationOutbox.findOne())?.outcome).toBe('delivery_failed'); expect(JSON.stringify(await NotificationOutbox.findOne())).not.toContain('Private');
    expect((await runNotificationBatch(10, new Date(now.getTime() + 4999))).claimed).toBe(0); expect((await runNotificationBatch(10, new Date(now.getTime() + 5001))).delivered).toBe(1); expect(await Notification.countDocuments()).toBe(1);
  });
  it('rolls back the inbox if final outbox acknowledgement fails', async () => {
    await queue(); vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Private acknowledgement failure'));
    expect((await drain()).retried).toBe(1); expect(await Notification.countDocuments()).toBe(0); expect((await NotificationOutbox.findOne())?.status).toBe('pending');
  });
  it('retains a dead letter after five failures and does not retry forever', async () => {
    await queue(); vi.spyOn(Notification, 'updateOne').mockRejectedValue(new Error('Private failure'));
    for (let attempt = 0; attempt < 5; attempt++) await runNotificationBatch(10, new Date(now.getTime() + attempt * 1000_000));
    expect(await NotificationOutbox.findOne().lean()).toMatchObject({ status: 'failed', attempts: 5, outcome: 'delivery_failed' }); expect((await runNotificationBatch(10, new Date('2040-01-01'))).claimed).toBe(0); expect(await Notification.countDocuments()).toBe(0);
  });
  it('recovers an abandoned lease, and a stale worker cannot write after another worker delivers', async () => {
    await queue(); const first = await claimNotification(now); expect(first).not.toBeNull(); const replacement = await claimNotification(new Date(now.getTime() + 61_000)); expect(replacement?.attempts).toBe(2);
    await deliverClaimedNotification(replacement!._id, replacement!.leaseToken!, new Date(now.getTime() + 61_000));
    await expect(deliverClaimedNotification(first!._id, first!.leaseToken!, now)).rejects.toMatchObject({ statusCode: 409 }); expect(await Notification.countDocuments()).toBe(1);
  });
  it('dead-letters exhausted crashed leases and invalid persisted categories without exposing payloads', async () => {
    await queue('exhausted'); await NotificationOutbox.updateOne({ dedupeKey: 'exhausted' }, { status: 'processing', attempts: 5, leaseUntil: new Date(now.getTime() - 1) }); await drain(); expect((await NotificationOutbox.findOne())?.outcome).toBe('lease_exhausted');
    await queue('invalid'); await NotificationOutbox.collection.updateOne({ dedupeKey: 'invalid' }, { $set: { kind: 'invalid-private-value' } }); expect((await drain()).failed).toBe(1); expect((await NotificationOutbox.findOne({ dedupeKey: 'invalid' }))?.outcome).toBe('invalid_notice');
  });
});

describe('real domain producers and confidential payloads', () => {
  it('connects real message creation without leaking previews or notifying the sender', async () => {
    await message(); expect(await NotificationOutbox.countDocuments()).toBe(1); await drain(); const row = await Notification.findOne(); expect(String(row?.ownerId)).toBe(String(ids.provider)); expect(row?.kind).toBe('message'); expect(JSON.stringify(row)).not.toContain('Private synthetic message');
  });
  it.each(['notifications', 'blocking', 'already_read', 'withdrawn_consent'])('suppresses pending message notices after %s', async scenario => {
    const row = await message();
    if (scenario === 'notifications') await MessagingSettings.create({ ownerId: ids.provider, notifications: false });
    if (scenario === 'blocking') await MessagingSettings.create({ ownerId: ids.provider, blockedIds: [ids.student] });
    if (scenario === 'already_read') await Message.updateOne({ _id: row!._id }, { readAt: new Date() });
    if (scenario === 'withdrawn_consent') await prefs({ categories: { ...defaultNotificationPreferences().categories, message: false } }, ids.provider);
    expect((await drain()).suppressed).toBe(1); expect(await Notification.countDocuments()).toBe(0);
  });
  it('keeps message and conversation metadata rolled back when the outbox cannot commit', async () => {
    await Opportunity.create(scholarshipFixture()); await Application.create(applicationFixture()); await Conversation.create(conversationFixture()); vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Private queue failure'));
    const response = await request(app).post(`/api/messages/conversations/${ids.conversation}/messages`).set('Authorization', bearer()).send({ content: 'Message which must not be committed without its transactional notice.' }); expect(response.status).toBe(503); expect(await Message.countDocuments()).toBe(0); expect((await Conversation.findById(ids.conversation))?.lastMessageAt).toBeUndefined();
  });
  it('notifies a real ordinary application decision once without changing its existing response contract', async () => {
    await Opportunity.create(scholarshipFixture({ type: 'job' })); const row = await Application.create(applicationFixture());
    const decide = () => request(app).patch(`/api/applications/${row._id}/status`).set('Authorization', bearer(ids.provider)).send({ status: 'reviewed' });
    expect((await decide()).status).toBe(200); expect((await decide()).status).toBe(200); expect(await NotificationOutbox.countDocuments()).toBe(1); await drain(); expect((await Notification.findOne())?.kind).toBe('application');
  });
  it('atomically notifies a provider of a new ordinary application and preserves duplicate protection', async () => {
    await Opportunity.create(scholarshipFixture({ type: 'job' }));
    const submit = () => request(app).post('/api/applications').set('Authorization', bearer()).send({ opportunityId: String(ids.scholarship), justification: 'Private ordinary job application justification for a synthetic applicant.', selfDeclaredNeed: 'high' });
    const results = await Promise.all([submit(), submit()]); expect(results.map(row => row.status).sort()).toEqual([201, 409]); expect(await Application.countDocuments()).toBe(1); expect(await NotificationOutbox.countDocuments()).toBe(1);
    await drain(); const row = await Notification.findOne(); expect(row?.kind).toBe('application'); expect(String(row?.ownerId)).toBe(String(ids.provider)); expect(JSON.stringify(row)).not.toContain('Private ordinary');
  });
  it('does not commit an ordinary application if its notification event cannot be saved', async () => {
    await Opportunity.create(scholarshipFixture({ type: 'internship' })); vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Private application notification failure'));
    const response = await request(app).post('/api/applications').set('Authorization', bearer()).send({ opportunityId: String(ids.scholarship), justification: 'An ordinary internship application which must roll back with its event.', selfDeclaredNeed: 'medium' });
    expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('Private'); expect(await Application.countDocuments()).toBe(0); expect(await NotificationOutbox.countDocuments()).toBe(0);
  });
  it('notifies scholarship decisions and appeals without copying confidential statements or reasons', async () => {
    await Opportunity.create(scholarshipFixture());
    const created = await request(app).post('/api/applications').set('Authorization', bearer()).send({ opportunityId: String(ids.scholarship), justification: 'Hidden confidential scholarship justification for a synthetic student.', selfDeclaredNeed: 'high' }); expect(created.status).toBe(201); const id = created.body.data.application._id;
    expect((await request(app).patch(`/api/applications/${id}/status`).set('Authorization', bearer(ids.provider)).send({ status: 'rejected', reason: 'Hidden confidential review reason for the student.' })).status).toBe(200);
    const appeal = await request(app).post(`/api/applications/${id}/scholarship/appeals`).set('Authorization', bearer()).send({ revision: 1, statement: 'Hidden confidential appeal statement for independent review by the owner.' }); expect(appeal.status).toBe(201);
    expect((await request(app).post(`/api/applications/${id}/scholarship/appeals/${appeal.body.data.appeal._id}/review`).set('Authorization', bearer(ids.provider)).send({ decision: 'upheld', reason: 'Hidden confidential appeal review explanation.' })).status).toBe(200);
    await drain(); expect(await Notification.countDocuments()).toBe(4); expect(JSON.stringify(await Notification.find())).not.toMatch(/Hidden confidential|justification|reason/);
  });
  it('notifies resource decisions and preserves reservation/audit rollback if enqueue fails', async () => {
    await Resource.create(resourceFixture()); const row = await ResourceRequest.create(resourceRequestFixture());
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Private queue failure'));
    const path = `/api/resource-requests/${row._id}/status`; expect((await request(app).patch(path).set('Authorization', bearer(ids.provider)).send({ status: 'accepted' })).status).toBe(503);
    expect((await Resource.findById(ids.resource))?.quantityAvailable).toBe(1); expect((await ResourceRequest.findById(row._id))?.status).toBe('pending'); expect(await ResourceEvent.countDocuments()).toBe(0);
    expect((await request(app).patch(path).set('Authorization', bearer(ids.provider)).send({ status: 'accepted' })).status).toBe(200); await drain(); expect((await Notification.findOne())?.kind).toBe('resource');
  });
  it('notifies provider verification changes to that provider only, without exposing review reasons', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'PENDING' });
    const response = await request(app).patch(`/api/admin/providers/${ids.provider}/request-info`).set('Authorization', bearer(ids.admin)).send({ documentId: null, reason: 'Hidden private organization verification review detail.' }); expect(response.status).toBe(200); await drain();
    const result = await request(app).get('/api/notifications').auth(generateVerificationToken(String(ids.provider), 1), { type: 'bearer' }); expect(result.status).toBe(200); expect(result.body.data.notifications[0]).toMatchObject({ kind: 'verification', href: '/provider-verification' }); expect(JSON.stringify(result.body)).not.toContain('Hidden private'); expect((await get()).body.data.total).toBe(0);
  });
  it('supports mentorship category delivery without inventing a mentorship production module', async () => {
    await queue('future-real-mentorship-event', ids.student, 'mentorship'); await drain(); expect((await Notification.findOne())?.kind).toBe('mentorship');
  });
});

describe('bounded reminder production and stale-source checks', () => {
  it('rotates over non-due rows and deduplicates scholarship reminders across wraparound scans', async () => {
    const opportunities = await Opportunity.create([scholarshipFixture(), scholarshipFixture({ _id: new Types.ObjectId(), applicationDeadline: new Date(now.getTime() + 3600_000) }), scholarshipFixture({ _id: new Types.ObjectId(), applicationDeadline: new Date(now.getTime() + 7200_000) })]);
    await Application.create(opportunities.map(opportunity => applicationFixture({ opportunityId: opportunity._id })));
    for (let count = 0; count < 7; count++) await enqueueNotificationReminders(1, now);
    expect(await NotificationOutbox.countDocuments({ action: 'deadline' })).toBe(2); expect(await NotificationProducer.countDocuments()).toBe(3); await drain(); expect(await Notification.countDocuments()).toBe(2);
  });
  it('suppresses a deadline reminder when the actual deadline is extended before delivery', async () => {
    await Opportunity.create(scholarshipFixture({ applicationDeadline: new Date(now.getTime() + 3600_000) })); await Application.create(applicationFixture()); await enqueueNotificationReminders(100, now);
    await Opportunity.updateOne({ _id: ids.scholarship }, { applicationDeadline: new Date(now.getTime() + 2 * 86_400_000) }); expect((await drain()).suppressed).toBe(1); expect((await NotificationOutbox.findOne())?.outcome).toBe('stale_source');
  });
  it('queues due/overdue reminders once per UTC day, rechecks completion, and never modifies inventory', async () => {
    await Resource.create(resourceFixture({ accessType: 'borrow', quantityAvailable: 0, status: 'claimed' }));
    const row = await ResourceRequest.create(resourceRequestFixture({ requestedAccessType: 'borrow', status: 'accepted', allocation: { returnRequired: true, accessType: 'borrow', inventoryReserved: true, dueAt: new Date(now.getTime() + 3600_000) } }));
    await enqueueNotificationReminders(100, now); await enqueueNotificationReminders(100, now); await enqueueNotificationReminders(100, now); expect(await NotificationOutbox.countDocuments()).toBe(1); await drain(); expect((await Notification.findOne())?.action).toBe('due');
    const tomorrow = new Date(now.getTime() + 86_400_000); await enqueueNotificationReminders(100, tomorrow); expect(await NotificationOutbox.countDocuments()).toBe(2);
    await ResourceRequest.updateOne({ _id: row._id }, { status: 'completed' }); await runNotificationBatch(100, tomorrow); expect(await Notification.countDocuments()).toBe(1); expect((await Resource.findById(ids.resource))?.quantityAvailable).toBe(0);
  });
  it('does not invent deadlines or return reminders for transfers or unsnapshotted legacy records', async () => {
    await ResourceRequest.create(resourceRequestFixture({ status: 'accepted' })); await enqueueNotificationReminders(100, now); expect(await NotificationOutbox.countDocuments()).toBe(0);
    await expect(enqueueNotificationReminders(101, now)).rejects.toMatchObject({ statusCode: 400 });
  });
});
