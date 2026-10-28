import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import PromotionRequest from '../../src/models/PromotionRequest';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { campaignFixture, ids, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase(); const student = generateToken(String(ids.student), 'student'); const provider = generateToken(String(ids.provider), 'provider'); const outsider = generateToken(String(ids.outsider), 'student');
const proposal = { studentId: String(ids.student), campaignBrief: 'Synthetic campus promotion campaign', deliverables: 'One synthetic portfolio submission', compensationType: 'experience', deadline: '2099-01-01T00:00:00.000Z' };
async function create() { const response = await request(app).post('/api/promotion-requests').auth(provider, { type: 'bearer' }).send(proposal); expect(response.status).toBe(201); return response.body.data.request; }
const status = (id: string, value: string, revision: number, actor = student) => request(app).patch(`/api/promotion-requests/${id}/status`).auth(actor, { type: 'bearer' }).send({ status: value, revision, reason: 'Synthetic participant cancellation reason.' });
beforeAll(() => database.start()); beforeEach(async () => {
  await database.clear(); await User.create([studentFixture({ studentProfile: { ...studentFixture().studentProfile, creatorProfile: { isDiscoverable: true, platforms: [], niches: [], contentTypes: [], compensationPreference: [], availability: 'available' } } }), providerFixture(), studentFixture({ _id: ids.outsider, email: 'outsider@example.test' })]);
}); afterAll(() => database.stop());
describe('campaign API and pending notices', () => {
  it('creates a pending invitation/history and an undelivered outbox notice', async () => {
    const row = await create(); expect(row).toMatchObject({ status: 'pending', stage: 'pending', workflowVersion: 2, revision: 0, deliveryStatus: 'not_submitted' }); expect(row.history[0].action).toBe('created'); expect(await NotificationOutbox.countDocuments({ ownerId: ids.student, status: 'pending' })).toBe(1);
  });
  it('requires creator availability and current provider verification', async () => {
    await User.updateOne({ _id: ids.student }, { 'studentProfile.creatorProfile.isDiscoverable': false }); expect((await request(app).post('/api/promotion-requests').auth(provider, { type: 'bearer' }).send(proposal)).status).toBe(404);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationStatus': 'PENDING' }); expect((await request(app).post('/api/promotion-requests').auth(provider, { type: 'bearer' }).send(proposal)).status).toBe(403); expect(await PromotionRequest.countDocuments()).toBe(0);
  });
  it('accepts, submits and approves work with participant-only revision checks', async () => {
    const row = await create(); expect((await status(row._id, 'accepted', 0, outsider)).status).toBe(403); expect((await status(row._id, 'accepted', 0)).status).toBe(200); expect((await status(row._id, 'completed', 1, provider)).status).toBe(409);
    expect((await status(row._id, 'in_progress', 1)).status).toBe(200);
    const submit = await request(app).post(`/api/promotion-requests/${row._id}/submissions`).auth(student, { type: 'bearer' }).send({ revision: 2, text: 'Synthetic completed work', urls: ['https://portfolio.example.test/work'] }); expect(submit.status).toBe(200);
    expect((await request(app).post(`/api/promotion-requests/${row._id}/review`).auth(provider, { type: 'bearer' }).send({ revision: 1, decision: 'approved' })).status).toBe(409);
    const reviewed = await request(app).post(`/api/promotion-requests/${row._id}/review`).auth(provider, { type: 'bearer' }).send({ revision: 3, submissionId: submit.body.data.request.submissions[0]._id, decision: 'approved' }); expect(reviewed.status).toBe(200); expect(reviewed.body.data.request.stage).toBe('reviewed'); expect(reviewed.body.data.request.status).toBe('accepted');
    const complete = await status(row._id, 'completed', 4, provider); expect(complete.status).toBe(200); expect(complete.body.data.request.status).toBe('completed'); expect(complete.body.data.request.history.map((entry: { action: string }) => entry.action)).toEqual(['created', 'accepted', 'started', 'submitted', 'approved', 'completed']);
  });
  it('supports a reasoned change request and resubmission', async () => {
    const row = await create(); await status(row._id, 'accepted', 0); await status(row._id, 'in_progress', 1); const submission = await request(app).post(`/api/promotion-requests/${row._id}/submissions`).auth(student, { type: 'bearer' }).send({ revision: 2, text: 'First draft' });
    const review = await request(app).post(`/api/promotion-requests/${row._id}/review`).auth(provider, { type: 'bearer' }).send({ revision: 3, submissionId: submission.body.data.request.submissions[0]._id, decision: 'changes_requested', note: 'Please revise the synthetic deliverable.' }); expect(review.status).toBe(200);
    const resubmit = await request(app).post(`/api/promotion-requests/${row._id}/submissions`).auth(student, { type: 'bearer' }).send({ revision: 4, text: 'Revised draft' }); expect(resubmit.status).toBe(200); expect(resubmit.body.data.request.submissions).toHaveLength(2);
  });
  it('supports decline/cancel and prevents actions after cancellation', async () => {
    const row = await create(); expect((await status(row._id, 'cancelled', 0, provider)).status).toBe(200); expect((await status(row._id, 'accepted', 1)).status).toBe(409);
    const another = await create(); expect((await status(another._id, 'declined', 0)).status).toBe(200);
  });
  it('rolls campaign creation back when its pending notice cannot be stored', async () => {
    const spy = vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Synthetic pending-notice failure'));
    try { expect((await request(app).post('/api/promotion-requests').auth(provider, { type: 'bearer' }).send(proposal)).status).toBe(503); expect(await PromotionRequest.countDocuments()).toBe(0); } finally { spy.mockRestore(); }
  });
  it('preserves legacy accepted-campaign completion', async () => {
    const row = await PromotionRequest.create({ ...campaignFixture(), status: 'accepted' }); expect((await status(String(row._id), 'completed', 0, provider)).status).toBe(200);
  });
});
