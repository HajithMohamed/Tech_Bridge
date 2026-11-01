import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import PromotionRequest from '../../src/models/PromotionRequest';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import MessagingSettings from '../../src/models/MessagingSettings';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, campaignFixture, ids, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const student = generateToken(String(ids.student), 'student'), provider = generateToken(String(ids.provider), 'provider'), outsider = generateToken(String(ids.outsider), 'student'), admin = generateToken(String(ids.admin), 'admin');
const creator = { isDiscoverable: true, displayName: 'Campus Alias', availability: 'available', platforms: [], niches: ['Campus'], contentTypes: ['Video'], compensationPreference: ['experience'], sampleWorkLinks: [] };
const proposal = () => ({ studentId: String(ids.student), campaignBrief: 'Synthetic campus campaign', deliverables: 'One portfolio video', compensationType: 'experience', deadline: '2099-01-01T00:00:00Z' });
const create = (body: object = proposal()) => request(app).post('/api/promotion-requests').auth(provider, { type: 'bearer' }).send(body);
const status = (id: string, value: string, revision?: number, actor = student) => request(app).patch(`/api/promotion-requests/${id}/status`).auth(actor, { type: 'bearer' }).send({ status: value, revision, reason: 'Synthetic participant cancellation reason' });
const detail = (id: string, actor = student) => request(app).get(`/api/promotion-requests/${id}`).auth(actor, { type: 'bearer' });
const submit = (id: string, revision?: number) => request(app).post(`/api/promotion-requests/${id}/submissions`).auth(student, { type: 'bearer' }).send({ text: 'Synthetic delivered work', urls: ['https://portfolio.example.test/work'], revision });
async function submittedCampaign() {
  const created = await create(); expect(created.status).toBe(201); const id = created.body.data.request._id;
  expect((await status(id, 'accepted', 0)).status).toBe(200); expect((await status(id, 'in_progress', 1)).status).toBe(200);
  const submitted = await submit(id, 2); expect(submitted.status).toBe(200); return submitted.body.data.request;
}
beforeAll(() => database.start()); beforeEach(async () => {
  await database.clear(); await User.create([studentFixture({ studentProfile: { ...studentFixture().studentProfile, creatorProfile: creator } }), studentFixture({ _id: ids.outsider, email: 'outsider@example.test', studentProfile: { ...studentFixture().studentProfile, creatorProfile: creator } }), providerFixture(), adminFixture()]);
}); afterAll(() => database.stop());

describe('private drafts, agreements and participant access', () => {
  it('keeps drafts private, audits amendments, and publishes one invitation event', async () => {
    const created = await create({ ...proposal(), saveAsDraft: true }); expect(created.status).toBe(201); const id = created.body.data.request._id;
    expect(created.body.data.request.stage).toBe('draft'); expect(await NotificationOutbox.countDocuments()).toBe(0); expect((await detail(id)).status).toBe(404);
    expect((await request(app).get('/api/promotion-requests/mine').auth(student, { type: 'bearer' })).body.data.total).toBe(0);
    const edit = await request(app).patch(`/api/promotion-requests/${id}/terms`).auth(provider, { type: 'bearer' }).send({ ...proposal(), deliverables: 'Two agreed portfolio videos', revision: 0 }); expect(edit.status).toBe(200);
    expect((await status(id, 'pending', 1, provider)).status).toBe(200); expect((await detail(id)).status).toBe(200); expect(await NotificationOutbox.countDocuments()).toBe(1);
    const accepted = await status(id, 'accepted', 2); expect(accepted.status).toBe(200); expect(accepted.body.data.request.agreedTerms.deliverables).toBe('Two agreed portfolio videos');
    expect(accepted.body.data.request.history.map((entry: { action: string }) => entry.action)).toEqual(['drafted', 'terms_updated', 'sent', 'accepted']);
    expect((await request(app).patch(`/api/promotion-requests/${id}/terms`).auth(provider, { type: 'bearer' }).send(proposal())).status).toBe(409);
  });
  it('never reveals a cancelled unpublished draft to its proposed student', async () => {
    const id = (await create({ ...proposal(), saveAsDraft: true })).body.data.request._id;
    expect((await status(id, 'cancelled', 0, provider)).status).toBe(200); expect((await detail(id)).status).toBe(404); expect((await status(id, 'accepted', 1)).status).toBe(404);
    expect((await request(app).get('/api/promotion-requests/mine').auth(student, { type: 'bearer' })).body.data.total).toBe(0); expect(await NotificationOutbox.countDocuments()).toBe(0);
  });
  it('rejects role bypasses, unrelated participants and draft retargeting', async () => {
    const id = (await create({ ...proposal(), saveAsDraft: true })).body.data.request._id;
    expect((await request(app).post('/api/promotion-requests').send(proposal())).status).toBe(401); expect((await request(app).post('/api/promotion-requests').auth(student, { type: 'bearer' }).send(proposal())).status).toBe(403);
    expect((await detail(id, outsider)).status).toBe(404); expect((await detail(id, admin)).status).toBe(403);
    expect((await request(app).patch(`/api/promotion-requests/${id}/terms`).auth(provider, { type: 'bearer' }).send({ ...proposal(), studentId: String(ids.outsider) })).status).toBe(400);
    expect((await status(id, 'pending', 0, provider)).status).toBe(200); expect((await status(id, 'accepted', 1, outsider)).status).toBe(403); expect((await status(id, 'accepted', 1, admin)).status).toBe(403);
  });
  it('retains optional-revision legacy accept/decline calls without allowing completion to skip work', async () => {
    const id = (await create()).body.data.request._id; expect((await status(id, 'accepted')).status).toBe(200); expect((await submit(id)).status).toBe(409); expect((await status(id, 'completed', undefined, provider)).status).toBe(409);
    expect((await status(id, 'in_progress')).status).toBe(200); expect((await submit(id)).status).toBe(200);
  });
  it('keeps account email/private fields and hidden portfolio data out of campaign reads', async () => {
    const id = (await create()).body.data.request._id; const visible = await detail(id, provider); expect(visible.body.data.request.studentId.fullName).toBe('Campus Alias');
    const serialized = JSON.stringify(visible.body.data.request); expect(serialized).not.toContain('student@example.test'); expect(serialized).not.toContain('Synthetic Student'); expect(serialized).not.toContain('tokenVersion');
    await User.updateOne({ _id: ids.student }, { 'studentProfile.creatorProfile.isDiscoverable': false }); const hidden = (await detail(id, provider)).body.data.request.studentId.studentProfile.creatorProfile;
    expect(hidden).toEqual({ isDiscoverable: false, niches: [], platforms: [] }); expect(visible.headers['cache-control']).toBe('no-store');
  });
});
describe('work, review, expiry and legacy compatibility', () => {
  it('requires the current submission ID and a distinct provider completion after approval', async () => {
    const row = await submittedCampaign(); const path = `/api/promotion-requests/${row._id}/review`; const submissionId = row.submissions[0]._id;
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'approved' })).status).toBe(400);
    expect((await request(app).post(path).auth(student, { type: 'bearer' }).send({ decision: 'approved', submissionId })).status).toBe(403);
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'approved', submissionId: String(ids.outsider) })).status).toBe(409);
    const reviewed = await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'approved', submissionId, revision: 3 }); expect(reviewed.status).toBe(200); expect(reviewed.body.data.request).toMatchObject({ stage: 'reviewed', status: 'accepted' });
    expect((await status(row._id, 'completed', 4)).status).toBe(409); const completed = await status(row._id, 'completed', 4, provider); expect(completed.status).toBe(200); expect(completed.body.data.request.stage).toBe('completed'); expect((await status(row._id, 'cancelled', 5)).status).toBe(409);
  });
  it('requires a reason for changes and prevents stale submission reviews after resubmission', async () => {
    const row = await submittedCampaign(); const path = `/api/promotion-requests/${row._id}/review`; const submissionId = row.submissions[0]._id;
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'changes_requested', submissionId, note: 'short' })).status).toBe(400);
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'changes_requested', submissionId, note: 'Please revise the video captions.' })).status).toBe(200);
    expect((await submit(row._id, 4)).status).toBe(200); expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'approved', submissionId })).status).toBe(409);
    const saved = await PromotionRequest.findById(row._id); expect(saved?.submissions).toHaveLength(2); expect(saved?.submissions[0].review).toBe('changes_requested'); expect(saved?.submissions[1].review).toBeUndefined();
  });
  it('rejects expired acceptance but permits a reasoned exit', async () => {
    const id = (await create()).body.data.request._id; await PromotionRequest.updateOne({ _id: id }, { deadline: new Date('2000-01-01') });
    expect((await status(id, 'accepted', 0)).status).toBe(409); expect((await status(id, 'declined', 0)).status).toBe(200);
  });
  it('marks late work for human review without automatically completing or cancelling it', async () => {
    const id = (await create()).body.data.request._id; await status(id, 'accepted', 0); await status(id, 'in_progress', 1);
    await PromotionRequest.updateOne({ _id: id }, { 'agreedTerms.deadline': new Date('2000-01-01') }); const response = await submit(id, 2); expect(response.status).toBe(200); expect(response.body.data.request).toMatchObject({ stage: 'submitted', status: 'accepted', submissions: [{ isLate: true }] });
  });
  it('allows a student to cancel when the provider becomes suspended or loses verification', async () => {
    const id = (await create()).body.data.request._id; await User.updateOne({ _id: ids.provider }, { accountStatus: 'suspended', 'providerProfile.verified': false });
    expect((await status(id, 'accepted', 0)).status).toBe(403); expect((await status(id, 'cancelled', 0)).status).toBe(200);
  });
  it('preserves version-one submit/review behavior and pre-workflow direct completion', async () => {
    const old = await PromotionRequest.create({ ...campaignFixture(), status: 'accepted', workflowVersion: 1, revision: 0, deliveryStatus: 'not_submitted' });
    expect((await submit(String(old._id), 0)).status).toBe(200); expect((await request(app).post(`/api/promotion-requests/${old._id}/review`).auth(provider, { type: 'bearer' }).send({ decision: 'approved', revision: 1 })).body.data.request.status).toBe('completed');
    const legacy = await PromotionRequest.create({ ...campaignFixture(), status: 'accepted' }); expect((await status(String(legacy._id), 'completed', 0, provider)).status).toBe(200);
  });
});
describe('concurrency, limits and transaction integrity', () => {
  it('serializes duplicate invitations and enqueues exactly one initial notice', async () => {
    const responses = await Promise.all([create(), create()]); expect(responses.map((r) => r.status).sort()).toEqual([201, 409]); expect(await PromotionRequest.countDocuments()).toBe(1); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('serializes competing accept/decline actions without duplicate history or events', async () => {
    const id = (await create()).body.data.request._id; const responses = await Promise.all([status(id, 'accepted', 0), status(id, 'declined', 0)]); expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const row = await PromotionRequest.findById(id); expect(row?.history).toHaveLength(2); expect(row?.revision).toBe(1); expect(await NotificationOutbox.countDocuments()).toBe(2);
  });
  it('serializes competing reviews of the same submission', async () => {
    const row = await submittedCampaign(); const body = { submissionId: row.submissions[0]._id, revision: 3 }; const path = `/api/promotion-requests/${row._id}/review`;
    const responses = await Promise.all([request(app).post(path).auth(provider, { type: 'bearer' }).send({ ...body, decision: 'approved' }), request(app).post(path).auth(provider, { type: 'bearer' }).send({ ...body, decision: 'changes_requested', note: 'Please revise this completed work.' })]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]); expect((await PromotionRequest.findById(row._id))?.revision).toBe(4); expect(await NotificationOutbox.countDocuments()).toBe(5);
  });
  it('rolls back stage, history, revision and account locks when the outbox fails', async () => {
    const id = (await create()).body.data.request._id; const before = (await User.findById(ids.student))?.__v;
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Synthetic private database fault'));
    const response = await status(id, 'accepted', 0); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('private database fault');
    const row = await PromotionRequest.findById(id); expect(row?.stage).toBe('pending'); expect(row?.revision).toBe(0); expect(row?.history).toHaveLength(1); expect((await User.findById(ids.student))?.__v).toBe(before); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('enforces the rolling provider creation cap even across concurrent different creators', async () => {
    await PromotionRequest.insertMany(Array.from({ length: 19 }, () => ({ ...campaignFixture(), status: 'declined' })));
    const responses = await Promise.all([create(), create({ ...proposal(), studentId: String(ids.outsider) })]); expect(responses.map((r) => r.status).sort()).toEqual([201, 429]); expect(await PromotionRequest.countDocuments()).toBe(20); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('blocks unavailable or blocked creators for published invitations and drafts', async () => {
    await MessagingSettings.create({ ownerId: ids.student, blockedIds: [ids.provider] }); expect((await create()).status).toBe(403); expect((await create({ ...proposal(), saveAsDraft: true })).status).toBe(403);
    await MessagingSettings.deleteMany({}); await User.updateOne({ _id: ids.student }, { 'studentProfile.creatorProfile.availability': 'unavailable' }); expect((await create()).status).toBe(404); expect(await PromotionRequest.countDocuments()).toBe(0);
  });
  it('releases the creation quota when prior records leave the rolling window', async () => {
    await PromotionRequest.insertMany(Array.from({ length: 20 }, () => ({ ...campaignFixture(), status: 'declined', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })));
    expect((await create()).status).toBe(201); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('refuses an eleventh submission without changing history, revision or notices', async () => {
    const id = (await create()).body.data.request._id;
    await PromotionRequest.updateOne({ _id: id }, { stage: 'changes_requested', status: 'accepted', deliveryStatus: 'changes_requested', submissions: Array.from({ length: 10 }, () => ({ _id: new Types.ObjectId(), text: 'Previous draft', urls: [], submittedAt: new Date(), review: 'changes_requested' })) });
    expect((await submit(id, 0)).status).toBe(409); const saved = await PromotionRequest.findById(id); expect(saved?.submissions).toHaveLength(10); expect(saved?.revision).toBe(0); expect(saved?.history).toHaveLength(1); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('reserves the final bounded activity slot for a reasoned cancellation', async () => {
    const id = (await create()).body.data.request._id; const entry = { action: 'started', actorId: ids.student, actorRole: 'student', at: new Date() };
    await PromotionRequest.updateOne({ _id: id }, { stage: 'in_progress', status: 'accepted', history: Array.from({ length: 99 }, () => entry) });
    expect((await submit(id, 0)).status).toBe(409); expect((await status(id, 'cancelled', 0)).status).toBe(200); expect((await PromotionRequest.findById(id))?.history).toHaveLength(100);
  });
  it('paginates scoped summaries deterministically and keeps full history in the detail endpoint', async () => {
    await PromotionRequest.insertMany(Array.from({ length: 3 }, () => ({ ...campaignFixture(), status: 'declined', createdAt: new Date('2026-01-01'), history: [{ action: 'created', actorId: ids.provider, actorRole: 'provider', at: new Date() }] })));
    await PromotionRequest.create({ ...campaignFixture(), studentId: ids.outsider, providerId: new Types.ObjectId(), status: 'declined' });
    const browse = (page: number) => request(app).get('/api/promotion-requests/mine').query({ page, limit: 1, status: 'declined' }).auth(student, { type: 'bearer' });
    const first = (await browse(1)).body.data; const second = (await browse(2)).body.data; expect(first).toMatchObject({ total: 3, pages: 3, page: 1, limit: 1 }); expect(first.requests[0]._id).not.toBe(second.requests[0]._id); expect((await browse(1)).body.data.requests[0]._id).toBe(first.requests[0]._id);
    expect(first.requests[0]).not.toHaveProperty('history'); expect(first.requests[0]).not.toHaveProperty('submissions'); expect((await detail(first.requests[0]._id)).body.data.request.history).toHaveLength(1);
    expect((await request(app).get('/api/promotion-requests/provider?limit=51').auth(provider, { type: 'bearer' })).status).toBe(400); expect((await request(app).get('/api/promotion-requests/mine?status=unknown').auth(student, { type: 'bearer' })).status).toBe(400);
  });
});
