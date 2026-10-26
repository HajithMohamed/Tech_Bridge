import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import Application from '../../src/models/Application';
import ResourceRequest from '../../src/models/ResourceRequest';
import PromotionRequest from '../../src/models/PromotionRequest';
import MessagingSettings from '../../src/models/MessagingSettings';
import MessagingSignal from '../../src/models/MessagingSignal';
import Report from '../../src/models/Report';
import MessageReviewAccess from '../../src/models/MessageReviewAccess';
import AuditLog from '../../src/models/AuditLog';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { currentStreamUser, publishMessageSignal } from '../../src/services/messageEvents';
import { TestDatabase } from '../support/database';
import { adminFixture, applicationFixture, campaignFixture, conversationFixture, ids, providerFixture, resourceRequestFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const token = (id = ids.student) => generateToken(String(id), 'student');
const base = `/api/messages/conversations/${ids.conversation}`;
const send = (content = 'A permitted private message.', id = ids.student) => request(app).post(`${base}/messages`).auth(token(id), { type: 'bearer' }).send({ content });
const block = (id = ids.provider, other = ids.student) => request(app).put(`/api/messages/blocks/${other}`).auth(token(id), { type: 'bearer' });
const settings = (id = ids.provider, acceptsMessages = false, notifications = true) => request(app).put('/api/messages/settings').auth(token(id), { type: 'bearer' }).send({ acceptsMessages, notifications });
async function reported() { const message = await Message.create({ conversationId: ids.conversation, senderId: ids.provider, content: 'The exact reported private message.' }); const response = await request(app).post('/api/reports').auth(token(), { type: 'bearer' }).send({ targetType: 'message', targetId: message._id, reason: 'Synthetic message complaint requiring review.' }); expect(response.status).toBe(201); return { message, report: response.body.data.report }; }
const evidence = (id: string, actor = ids.admin) => request(app).post(`/api/admin/reports/${id}/message-evidence`).auth(token(actor), { type: 'bearer' }).send({ reason: 'Reviewing the exact reported content for a complaint decision.' });
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); await User.create([studentFixture(), providerFixture(), adminFixture(), studentFixture({ _id: ids.outsider, email: 'outsider@example.test' })]); await Application.create(applicationFixture()); await Conversation.create(conversationFixture()); });
afterAll(() => database.stop());

describe('transactional internal messaging', () => {
  it('requires full authenticated sessions for settings, messages and streams', async () => {
    for (const path of ['/api/messages/settings', '/api/messages/conversations', '/api/messages/events']) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
    }
  });
  it('creates one conversation under competing starts and preserves the existing key', async () => {
    await Conversation.deleteMany({});
    const responses = await Promise.all([1, 2, 3].map(() => request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId: String(ids.provider) })));
    expect(responses.map((item) => item.status)).toEqual([201, 201, 201]); expect(new Set(responses.map((item) => item.body.data.conversation._id)).size).toBe(1); expect(await Conversation.countDocuments()).toBe(1);
  });
  it('rejects malformed, self and unavailable recipients', async () => {
    for (const recipientId of ['invalid', String(ids.student), ['000000000000000000000002']]) expect((await request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId })).status).toBe(400);
    expect((await request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId: String(new Types.ObjectId()) })).status).toBe(403);
  });
  it('rechecks a rejected relationship on both starts and existing sends', async () => {
    await Application.updateMany({}, { status: 'rejected' });
    expect((await send()).status).toBe(403); expect((await send('Provider reply', ids.provider)).status).toBe(403);
    expect((await request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId: String(ids.provider) })).status).toBe(403);
    expect(await Message.countDocuments()).toBe(0);
  });
  it.each(['resource', 'campaign'])('allows an active %s relationship independently', async (kind) => {
    await Application.deleteMany({});
    if (kind === 'resource') await ResourceRequest.create(resourceRequestFixture()); else await PromotionRequest.create({ ...campaignFixture(), status: 'accepted' });
    expect((await send()).status).toBe(201);
  });
  it('prevents an unverified, suspended or deleted recipient receiving an existing send', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false }); expect((await send()).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, accountStatus: 'suspended' }); expect((await send()).status).toBe(403);
    await User.deleteOne({ _id: ids.provider }); expect((await send()).status).toBe(403);
  });
  it('validates content and IDs without saving malformed messages', async () => {
    for (const content of ['', ' '.repeat(10), 'a'.repeat(2001), {}, ['hello'], 'hidden\u0000text']) expect((await request(app).post(`${base}/messages`).auth(token(), { type: 'bearer' }).send({ content })).status).toBe(400);
    expect((await request(app).post('/api/messages/conversations/bad/messages').auth(token(), { type: 'bearer' }).send({ content: 'hello' })).status).toBe(400); expect(await Message.countDocuments()).toBe(0);
  });
  it('denies outsider and administrator history, reads, sends and typing', async () => {
    for (const id of [ids.outsider, ids.admin]) {
      expect((await request(app).get(`${base}/messages`).auth(token(id), { type: 'bearer' })).status).toBe(404);
      expect((await send('Intrusion', id)).status).toBe(404);
      expect((await request(app).patch(`${base}/read`).auth(token(id), { type: 'bearer' })).status).toBe(404);
      expect((await request(app).post(`${base}/typing`).auth(token(id), { type: 'bearer' })).status).toBe(404);
    }
  });
  it('rolls back message insertion when the conversation update fails', async () => {
    const spy = vi.spyOn(Conversation, 'updateOne').mockRejectedValueOnce(new Error('Synthetic write failure'));
    try { expect((await send()).status).toBe(503); expect(await Message.countDocuments()).toBe(0); expect((await Conversation.findById(ids.conversation))?.lastMessageAt).toBeUndefined(); } finally { spy.mockRestore(); }
  });
  it('enforces a shared minute quota under competing sends', async () => {
    await Message.insertMany(Array.from({ length: 19 }, (_, i) => ({ conversationId: ids.conversation, senderId: ids.student, content: `Recent message ${i}` })));
    const responses = await Promise.all([send('Race one'), send('Race two')]);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 429]); expect(await Message.countDocuments()).toBe(20); expect(responses.find((item) => item.status === 429)!.headers['retry-after']).toBe('60');
  });
  it('enforces the hourly quota independently of the minute quota', async () => {
    await Message.insertMany(Array.from({ length: 100 }, (_, i) => ({ conversationId: ids.conversation, senderId: ids.student, content: `Hourly message ${i}`, createdAt: new Date(Date.now() - 120_000) })));
    expect((await send()).status).toBe(429); expect(await Message.countDocuments()).toBe(100);
  });
  it('limits new conversations while allowing an existing connection', async () => {
    await Conversation.insertMany(Array.from({ length: 10 }, () => { const other = new Types.ObjectId(); return { participantIds: [ids.student, other], participantKey: [String(ids.student), String(other)].sort().join(':'), initiatedBy: ids.student }; }));
    expect((await request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId: String(ids.provider) })).status).toBe(201);
    await Conversation.deleteOne({ _id: ids.conversation }); expect((await request(app).post('/api/messages/conversations').auth(token(), { type: 'bearer' }).send({ recipientId: String(ids.provider) })).status).toBe(429);
  });
  it('blocks both directions and typing, preserves history, then permits an explicit unblock', async () => {
    expect((await send()).status).toBe(201); expect((await block()).status).toBe(200); expect((await block()).status).toBe(200);
    expect((await send()).status).toBe(403); expect((await send('Blocked reply', ids.provider)).status).toBe(403); expect((await request(app).post(`${base}/typing`).auth(token(), { type: 'bearer' })).status).toBe(403);
    expect((await request(app).get(`${base}/messages`).auth(token(), { type: 'bearer' })).body.data.messages).toHaveLength(1);
    const owner = await request(app).get('/api/messages/settings').auth(token(ids.provider), { type: 'bearer' }); expect(owner.body.data.blockedUsers).toEqual([{ _id: String(ids.student), fullName: 'Synthetic Student' }]);
    const other = await request(app).get('/api/messages/settings').auth(token(), { type: 'bearer' }); expect(other.body.data.blockedUsers).toEqual([]);
    expect((await request(app).delete(`/api/messages/blocks/${ids.student}`).auth(token(ids.provider), { type: 'bearer' })).status).toBe(200); expect((await send()).status).toBe(201);
  });
  it('serializes block withdrawal with competing sends', async () => {
    const responses = await Promise.all([send(), block()]); expect([201, 403]).toContain(responses[0].status); expect(responses[1].status).toBe(200);
    expect((await send('After block committed')).status).toBe(403); expect(await Message.countDocuments()).toBe(responses[0].status === 201 ? 1 : 0);
  });
  it('serializes receiving-preference withdrawal with sends and keeps notices independent', async () => {
    const responses = await Promise.all([send(), settings()]); expect([201, 403]).toContain(responses[0].status); expect(responses[1].status).toBe(200); expect((await send()).status).toBe(403);
    expect((await settings(ids.provider, true, false)).status).toBe(200); expect((await send()).status).toBe(201);
    const summary = await request(app).get('/api/messages/summary').auth(token(ids.provider), { type: 'bearer' }); expect(summary.body.data.notifications).toBe(false); expect(summary.body.data.unread).toBeGreaterThan(0);
  });
  it('rejects preference mass assignment and invalid block operations', async () => {
    expect((await request(app).put('/api/messages/settings').auth(token(), { type: 'bearer' }).send({ acceptsMessages: true, notifications: true, ownerId: String(ids.provider) })).status).toBe(400);
    expect((await block(ids.student, ids.student)).status).toBe(400); expect((await block(ids.student, new Types.ObjectId())).status).toBe(404);
    expect(await MessagingSettings.countDocuments()).toBe(0);
  });
  it('bounds block lists and allows an idempotent block at capacity', async () => {
    const blockedIds = [ids.provider, ...Array.from({ length: 199 }, () => new Types.ObjectId())]; await MessagingSettings.create({ ownerId: ids.student, blockedIds });
    expect((await block(ids.student, ids.provider)).status).toBe(200); expect((await block(ids.student, ids.outsider)).status).toBe(409); expect((await MessagingSettings.findOne({ ownerId: ids.student }))?.blockedIds).toHaveLength(200);
  });
  it('paginates conversations without exposing another owner’s rows', async () => {
    await Conversation.insertMany(Array.from({ length: 23 }, () => { const other = new Types.ObjectId(); return { participantIds: [ids.student, other], participantKey: [String(ids.student), String(other)].sort().join(':') }; }));
    const first = await request(app).get('/api/messages/conversations').auth(token(), { type: 'bearer' }); const second = await request(app).get('/api/messages/conversations?page=2').auth(token(), { type: 'bearer' }); expect(first.body.data.conversations).toHaveLength(20); expect(second.body.data.conversations).toHaveLength(4); expect(first.body.data.total).toBe(24); expect(first.body.data.pages).toBe(2); expect(new Set([...first.body.data.conversations, ...second.body.data.conversations].map((row: { _id: string }) => row._id)).size).toBe(24);
  });
  it('searches only owned conversations with literal queries and stable bounded pages', async () => {
    expect((await send()).status).toBe(201);
    const list = await request(app).get('/api/messages/conversations?q=provider').auth(token(), { type: 'bearer' }); expect(list.body.data.total).toBe(1); expect(list.body.data.conversations[0].otherParticipant).not.toHaveProperty('email'); expect(list.body.data.conversations[0].lastMessagePreview).toBe('A permitted private message.');
    expect((await request(app).get('/api/messages/conversations?q=(.*)').auth(token(), { type: 'bearer' })).body.data.total).toBe(0);
    expect((await request(app).get('/api/messages/conversations').auth(token(ids.outsider), { type: 'bearer' })).body.data.total).toBe(0);
    expect((await request(app).get('/api/messages/conversations?page=1garbage').auth(token(), { type: 'bearer' })).status).toBe(400);
  });
  it('paginates messages with equal timestamps without duplicates and rejects a foreign cursor', async () => {
    const createdAt = new Date('2026-01-01T12:00:00Z'); await Message.insertMany(Array.from({ length: 45 }, (_, i) => ({ conversationId: ids.conversation, senderId: ids.provider, content: `History ${i}`, createdAt })));
    const latest = await request(app).get(`${base}/messages`).auth(token(), { type: 'bearer' }); expect(latest.body.data.messages).toHaveLength(40); expect(latest.body.data.hasMore).toBe(true);
    const older = await request(app).get(`${base}/messages?before=${latest.body.data.nextBefore}`).auth(token(), { type: 'bearer' }); expect(older.body.data.messages).toHaveLength(5); expect(older.body.data.hasMore).toBe(false);
    expect(new Set([...latest.body.data.messages, ...older.body.data.messages].map((item: { _id: string }) => item._id)).size).toBe(45);
    const foreign = await Message.create({ conversationId: new Types.ObjectId(), senderId: ids.provider, content: 'Foreign private history' }); expect((await request(app).get(`${base}/messages?before=${foreign._id}`).auth(token(), { type: 'bearer' })).status).toBe(400);
  });
  it('marks only messages through the displayed receipt and updates unread counts', async () => {
    const first = await Message.create({ conversationId: ids.conversation, senderId: ids.provider, content: 'First incoming' }); const second = await Message.create({ conversationId: ids.conversation, senderId: ids.provider, content: 'Second incoming' });
    expect((await request(app).patch(`${base}/read`).auth(token(), { type: 'bearer' }).send({ throughId: String(first._id) })).status).toBe(200);
    expect((await Message.findById(first._id))?.readAt).toBeInstanceOf(Date); expect((await Message.findById(second._id))?.readAt).toBeUndefined();
    expect((await request(app).get('/api/messages/summary').auth(token(), { type: 'bearer' })).body.data.unread).toBe(1);
  });
  it('authorizes and rate limits ephemeral typing events', async () => {
    expect((await request(app).post(`${base}/typing`).auth(token(), { type: 'bearer' })).status).toBe(200);
    expect((await request(app).post(`${base}/typing`).auth(token(), { type: 'bearer' })).status).toBe(429); expect(await Message.countDocuments()).toBe(0);
  });
});

describe('scoped complaint evidence', () => {
  it('limits daily complaints and rejects self-review by the reported administrator', async () => {
    const { report } = await reported();
    await Report.insertMany(Array.from({ length: 9 }, () => ({ reporterId: ids.student, targetType: 'message', targetId: new Types.ObjectId(), reason: 'Synthetic existing complaint' })));
    const extra = await Message.create({ conversationId: ids.conversation, senderId: ids.provider, content: 'Additional incoming message' }); expect((await request(app).post('/api/reports').auth(token(), { type: 'bearer' }).send({ targetType: 'message', targetId: String(extra._id), reason: 'Additional complaint beyond quota' })).status).toBe(429);
    await Message.updateOne({ _id: report.targetId }, { senderId: ids.admin }); expect((await evidence(report._id)).status).toBe(403); expect(await MessageReviewAccess.countDocuments()).toBe(0);
  });
  it('only allows a participant to report an incoming message and prevents duplicates', async () => {
    const { message, report } = await reported();
    for (const actor of [ids.outsider, ids.provider]) expect((await request(app).post('/api/reports').auth(token(actor), { type: 'bearer' }).send({ targetType: 'message', targetId: String(message._id), reason: 'Invalid access attempt' })).status).toBe(404);
    expect((await request(app).post('/api/reports').auth(token(), { type: 'bearer' }).send({ targetType: 'message', targetId: String(message._id), reason: 'Duplicate report attempt' })).status).toBe(409); expect(await Report.countDocuments()).toBe(1); expect(report.status).toBe('open');
  });
  it('audits administrator access and exposes exactly the reported message', async () => {
    const { report } = await reported(); await Message.create({ conversationId: ids.conversation, senderId: ids.student, content: 'Unreported neighboring private content.' });
    expect((await evidence(report._id, ids.student)).status).toBe(403);
    const response = await evidence(report._id); expect(response.status).toBe(200); expect(response.body.data.message.content).toBe('The exact reported private message.'); expect(response.body.data.message).not.toHaveProperty('conversationId'); expect(JSON.stringify(response.body)).not.toContain('neighboring');
    expect(await MessageReviewAccess.countDocuments({ reportId: report._id, actorId: ids.admin })).toBe(1); expect(await AuditLog.countDocuments({ action: 'reported_message_accessed' })).toBe(1); expect(response.headers['cache-control']).toBe('no-store');
  });
  it('fails closed if audit persistence fails', async () => {
    const { report } = await reported(); const spy = vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('Synthetic audit failure'));
    try { const response = await evidence(report._id); expect(response.status).toBe(503); expect(response.body).not.toHaveProperty('data'); expect(await MessageReviewAccess.countDocuments()).toBe(0); } finally { spy.mockRestore(); }
  });
  it('requires evidence access before review, a reasoned outcome, and closes further access', async () => {
    const { report } = await reported(); const resolve = (note = 'Independently reviewed the exact reported content.') => request(app).patch(`/api/admin/reports/${report._id}`).auth(token(ids.admin), { type: 'bearer' }).send({ status: 'reviewed', resolutionNote: note });
    expect((await resolve()).status).toBe(409); expect((await resolve('short')).status).toBe(400); expect((await evidence(report._id)).status).toBe(200); expect((await resolve()).status).toBe(200); expect((await evidence(report._id)).status).toBe(404); expect((await resolve()).status).toBe(409);
    expect(await AuditLog.countDocuments({ action: 'message_report_resolved' })).toBe(1);
  });
  it('rejects invalid legacy complaints without disclosing evidence', async () => {
    const { message } = await reported(); const invalid = await Report.create({ reporterId: ids.outsider, targetType: 'message', targetId: message._id, reason: 'Legacy arbitrary target report.' }); expect((await evidence(String(invalid._id))).status).toBe(404); expect(await MessageReviewAccess.countDocuments()).toBe(0);
  });
});

describe('authenticated live message signals', () => {
  it('rechecks expiration, suspension and session version beyond initial authentication', async () => {
    const expired = jwt.sign({ userId: String(ids.student), role: 'student', version: 0 }, process.env.JWT_SECRET!, { expiresIn: -1 }); await expect(currentStreamUser(`Bearer ${expired}`)).rejects.toMatchObject({ statusCode: 401 });
    await expect(currentStreamUser(`Bearer ${token()}`)).resolves.toMatchObject({ role: 'student' });
    await User.updateOne({ _id: ids.student }, { $inc: { tokenVersion: 1 } }); await expect(currentStreamUser(`Bearer ${token()}`)).rejects.toMatchObject({ statusCode: 401 });
    await User.updateOne({ _id: ids.student }, { tokenVersion: 0, accountStatus: 'suspended' }); await expect(currentStreamUser(`Bearer ${token()}`)).rejects.toMatchObject({ statusCode: 403 });
    await expect(currentStreamUser(`Bearer ${generateVerificationToken(String(ids.provider))}`)).rejects.toMatchObject({ statusCode: 401 });
  });
  it('delivers only the authenticated owner’s hints and disconnects a revoked session', async () => {
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address() as { port: number }; const controller = new AbortController();
    try {
      const stream = await fetch(`http://127.0.0.1:${address.port}/api/messages/events?userId=${ids.provider}`, { headers: { Authorization: `Bearer ${token()}` }, signal: controller.signal });
      expect(stream.status).toBe(200); expect(stream.headers.get('content-type')).toContain('text/event-stream'); const reader = stream.body!.getReader(); const decoder = new TextDecoder(); expect(decoder.decode((await reader.read()).value)).toContain('refresh');
      await publishMessageSignal([String(ids.provider)], { type: 'typing', conversationId: String(ids.conversation), expiresAt: 123 });
      await MessagingSettings.create({ ownerId: ids.provider, blockedIds: [ids.student] });
      await publishMessageSignal([String(ids.student)], { type: 'typing', conversationId: String(ids.conversation), expiresAt: Date.now() + 4000 });
      await publishMessageSignal([String(ids.student)]); const hint = decoder.decode((await reader.read()).value); expect(hint).toBe('data: {"type":"refresh"}\n\n'); expect(hint).not.toContain('typing'); expect(hint).not.toContain('content');
      await User.updateOne({ _id: ids.student }, { $inc: { tokenVersion: 1 } }); await publishMessageSignal([String(ids.student)]); expect((await reader.read()).done).toBe(true); await reader.cancel();
    } finally { controller.abort(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
  it('retains a committed-change refresh arriving while a typing hint is being authorized', async () => {
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address() as { port: number }; const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const stream = await fetch(`http://127.0.0.1:${address.port}/api/messages/events`, { headers: { Authorization: `Bearer ${token()}` }, signal: controller.signal });
      const reader = stream.body!.getReader(); const decoder = new TextDecoder(); await reader.read();
      // Authorization performs real database queries. A concurrent receipt or
      // message refresh must survive while that earlier typing hint is in flight.
      deadline = setTimeout(() => controller.abort(), 5000);
      const typing = publishMessageSignal([String(ids.student)], { type: 'typing', conversationId: String(ids.conversation), expiresAt: Date.now() + 4000 });
      await Promise.all([typing, publishMessageSignal([String(ids.student)])]);
      let frames = '';
      while (!frames.includes('data: {"type":"refresh"}\n\n')) {
        const next = await reader.read(); expect(next.done).toBe(false); frames += decoder.decode(next.value, { stream: true });
      }
      expect(frames).toContain('"type":"typing"');
      expect(frames.indexOf('"type":"refresh"')).toBeGreaterThan(frames.indexOf('"type":"typing"'));
      await reader.cancel();
    } finally { clearTimeout(deadline); controller.abort(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
  it('shares ephemeral hints across API workers and limits concurrent streams', async () => {
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address() as { port: number }; const controller = new AbortController();
    let publisher: ReturnType<typeof setInterval> | undefined;
    const publications: Promise<unknown>[] = [];
    try {
      const endpoint = `http://127.0.0.1:${address.port}/api/messages/events`; const options = { headers: { Authorization: `Bearer ${token()}` }, signal: controller.signal };
      const streams = await Promise.all([fetch(endpoint, options), fetch(endpoint, options), fetch(endpoint, options)]); const reader = streams[0].body!.getReader(); await reader.read();
      expect((await fetch(endpoint, options)).status).toBe(429);
      // Simulate another worker's shared channel, never its private memory bus.
      // Repetition also covers opening a stream while its Mongo cursor starts.
      publisher = setInterval(() => { publications.push(MessagingSignal.create({ ownerId: ids.student, workerId: 'synthetic-other-worker', type: 'typing', conversationId: ids.conversation, expiresAt: new Date(Date.now() + 4000) })); }, 100);
      const frame = new TextDecoder().decode((await reader.read()).value); expect(frame).toContain('"type":"typing"'); expect(frame).toContain(String(ids.conversation)); expect(frame).not.toContain('Synthetic Provider');
      clearInterval(publisher); await reader.cancel();
    } finally { clearInterval(publisher); await Promise.all(publications); controller.abort(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
