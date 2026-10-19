import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import Application from '../../src/models/Application';
import Opportunity from '../../src/models/Opportunity';
import User from '../../src/models/User';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { applicationFixture, ids, providerFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const app = createApp();
const database = new TestDatabase();
const first = new Types.ObjectId('000000000000000000000031');
const second = new Types.ObjectId('000000000000000000000032');
const otherOpportunity = new Types.ObjectId('000000000000000000000033');
const submittedAt = new Date(new Date().getFullYear(), 0, 1, 0, 1);
const bearer = (id = ids.provider, role = 'provider') => `Bearer ${generateToken(id.toString(), role)}`;
const decide = (status: unknown, id = first, owner = ids.provider) => request(app).patch(`/api/applications/${id}/status`).set('Authorization', bearer(owner)).send({ status });
const edit = (payload: object, id = ids.scholarship, owner = ids.provider) => request(app).put(`/api/opportunities/${id}`).set('Authorization', bearer(owner)).send(payload);
const mentorship = { type: 'mentorship', mentorName: 'Synthetic Mentor', professionalField: 'Testing', mentorshipType: 'Technical guidance', availability: 'Test hours' };

beforeAll(() => database.start());
beforeEach(async () => {
  await database.clear();
  await User.create([providerFixture(), studentFixture(), studentFixture({ _id: ids.outsider, email: 'other-student@example.test' })]);
  await Opportunity.create(scholarshipFixture());
  await Application.create(applicationFixture({ _id: first, appliedAt: submittedAt }));
});
afterAll(() => database.stop());

describe('scholarship decisions with real API + MongoDB transactions', () => {
  it('accepts a human decision with the existing populated response', async () => {
    const before = await User.findById(ids.student).lean();
    const result = await decide('accepted');
    expect(result.status).toBe(200);
    expect(result.body.data.application).toMatchObject({ status: 'accepted', studentId: { fullName: 'Synthetic Student' }, opportunityId: { title: 'Synthetic Scholarship' } });
    expect(result.body.data.application.studentId).not.toHaveProperty('password');
    expect(await User.findById(ids.student).lean()).toEqual({ ...before, __v: 1 });
  });
  it('does not automatically accept an application while serving priority explanations', async () => {
    const result = await request(app).get(`/api/applications/opportunity/${ids.scholarship}`).set('Authorization', bearer());
    expect(result.status).toBe(200);
    expect(result.body.data.applications[0].priorityScore).toEqual(expect.any(Number));
    expect((await Application.findById(first))?.status).toBe('applied');
  });
  it('awards the last place to only one of two competing students', async () => {
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    const results = await Promise.all([decide('accepted'), decide('accepted', second)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(1);
    expect(await Application.countDocuments({ status: 'applied' })).toBe(1);
  });
  it('accepts two different students when there are two awards', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { numberOfAwards: 2 });
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    const results = await Promise.all([decide('accepted'), decide('accepted', second)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(2);
  });
  it('makes six repeats of the same approval idempotent without six awards', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => decide('accepted')));
    expect(results.map((result) => result.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(1);
    expect((await User.findById(ids.student))?.__v).toBe(1);
    expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(1);
  });
  it('serializes one student\'s current-year scholarship approvals across providers', async () => {
    await User.create(providerFixture({ _id: ids.lecturer, email: 'second-provider@example.test' }));
    await Opportunity.create(scholarshipFixture({ _id: otherOpportunity, providerId: ids.lecturer }));
    await Application.create(applicationFixture({ _id: second, opportunityId: otherOpportunity, providerId: ids.lecturer, appliedAt: submittedAt }));
    const results = await Promise.all([decide('accepted'), decide('accepted', second, ids.lecturer)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await Application.countDocuments({ studentId: ids.student, status: 'accepted' })).toBe(1);
  });
  it('preserves the existing application-date year policy for historic benefits', async () => {
    await Opportunity.create(scholarshipFixture({ _id: otherOpportunity }));
    await Application.create(applicationFixture({ _id: second, opportunityId: otherOpportunity, status: 'accepted', appliedAt: new Date(submittedAt.getFullYear() - 1, 0, 2) }));
    expect((await decide('accepted')).status).toBe(200);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(2);
  });
  it('preserves existing status reversals and frees capacity after rejection', async () => {
    for (const status of ['reviewed', 'accepted', 'rejected', 'applied']) expect((await decide(status)).status).toBe(200);
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    expect((await decide('accepted', second)).status).toBe(200);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(1);
  });
  it.each(['suspended', 'deleted'])('does not award to a %s student', async (state) => {
    if (state === 'deleted') await User.deleteOne({ _id: ids.student });
    else await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' });
    expect((await decide('accepted')).status).toBe(409);
    expect((await Application.findById(first))?.status).toBe('applied');
    expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(0);
  });
  it('checks authentication, provider role and both recorded owners', async () => {
    expect((await request(app).patch(`/api/applications/${first}/status`).send({ status: 'accepted' })).status).toBe(401);
    expect((await decide('accepted', first, ids.student)).status).toBe(403);
    await User.create(providerFixture({ _id: ids.lecturer, email: 'outsider-provider@example.test' }));
    expect((await decide('accepted', first, ids.lecturer)).status).toBe(404);
    await Opportunity.updateOne({ _id: ids.scholarship }, { providerId: ids.lecturer });
    expect((await decide('accepted')).status).toBe(404);
    expect((await Application.findById(first))?.status).toBe('applied');
  });
  it('rejects invalid input and missing records without changing state', async () => {
    expect((await request(app).patch('/api/applications/bad-id/status').set('Authorization', bearer()).send({ status: 'accepted' })).status).toBe(400);
    expect((await decide('awarded')).status).toBe(400);
    expect((await request(app).patch(`/api/applications/${first}/status`).set('Authorization', bearer())).status).toBe(400);
    expect((await decide('accepted', second)).status).toBe(404);
    expect((await Application.findById(first))?.status).toBe('applied');
  });
  it('rolls back coordination writes if saving the award fails', async () => {
    vi.spyOn(Application.prototype, 'save').mockImplementationOnce(() => { throw new Error('Private injected save failure'); });
    const result = await decide('accepted');
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('Private');
    expect((await Application.findById(first))?.status).toBe('applied');
    expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(0);
    expect((await User.findById(ids.student))?.__v).toBe(0);
  });
  it('refuses to lower capacity below accepted applications', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { numberOfAwards: 2 });
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    expect((await decide('accepted')).status).toBe(200);
    expect((await decide('accepted', second)).status).toBe(200);
    expect((await edit({ numberOfAwards: 1 })).status).toBe(409);
    expect((await Opportunity.findById(ids.scholarship))?.numberOfAwards).toBe(2);
  });
  it('serializes capacity reduction against a competing approval', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { numberOfAwards: 2 });
    await Application.updateOne({ _id: first }, { status: 'accepted' });
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    const results = await Promise.all([decide('accepted', second), edit({ numberOfAwards: 1 })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const opportunity = await Opportunity.findById(ids.scholarship);
    expect(await Application.countDocuments({ status: 'accepted' })).toBeLessThanOrEqual(opportunity!.numberOfAwards!);
  });
  it('allows increasing capacity before another human approval', async () => {
    expect((await decide('accepted')).status).toBe(200);
    expect((await edit({ numberOfAwards: 2, title: 'Updated Synthetic Scholarship' })).status).toBe(200);
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    expect((await decide('accepted', second)).status).toBe(200);
  });
  it('prevents scholarship type changes once applications exist', async () => {
    expect((await edit(mentorship)).status).toBe(409);
    expect((await Opportunity.findById(ids.scholarship))?.type).toBe('scholarship');
  });
  it('also prevents converting an applied-to non-scholarship listing into a scholarship', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, mentorship);
    expect((await edit({ type: 'scholarship' })).status).toBe(409);
    expect((await Opportunity.findById(ids.scholarship))?.type).toBe('mentorship');
  });
  it('still allows type changes before applications exist', async () => {
    await Application.deleteMany({});
    expect((await edit(mentorship)).status).toBe(200);
    expect((await Opportunity.findById(ids.scholarship))?.type).toBe('mentorship');
  });
  it('keeps non-scholarship status decisions free of scholarship capacity limits', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, mentorship);
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    const results = await Promise.all([decide('accepted'), decide('accepted', second)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await Application.countDocuments({ status: 'accepted' })).toBe(2);
  });
  it('retains opportunity input validation and provider capability enforcement', async () => {
    expect((await request(app).put('/api/opportunities/not-an-id').set('Authorization', bearer()).send({})).status).toBe(400);
    expect((await request(app).put(`/api/opportunities/${ids.scholarship}`).set('Authorization', bearer())).status).toBe(400);
    expect((await edit({ numberOfAwards: 0 })).status).toBe(400);
    expect((await edit({ type: 'job', paymentInfo: 'Synthetic salary' })).status).toBe(403);
    expect((await edit({ status: 'expired' })).status).toBe(400);
    expect((await edit({ title: 'x' })).status).toBe(400);
    expect((await edit({ title: 'x'.repeat(161) })).status).toBe(400);
    expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(0);
  });
  it('retains the missing-capacity fallback for legacy scholarships', async () => {
    await Opportunity.collection.updateOne({ _id: ids.scholarship }, { $unset: { numberOfAwards: '' } });
    expect((await decide('accepted')).status).toBe(200);
    await Application.create(applicationFixture({ _id: second, studentId: ids.outsider, appliedAt: submittedAt }));
    expect((await decide('accepted', second)).status).toBe(409);
  });
  it('fails safely for corrupt legacy capacity rather than treating it as an award', async () => {
    await Opportunity.collection.updateOne({ _id: ids.scholarship }, { $set: { numberOfAwards: 0 } });
    expect((await decide('accepted')).status).toBe(409);
    expect((await Application.findById(first))?.status).toBe('applied');
  });
  it('rolls back a capacity edit if saving fails', async () => {
    vi.spyOn(Opportunity.prototype, 'save').mockImplementationOnce(() => { throw new Error('Private edit failure'); });
    const result = await edit({ numberOfAwards: 2 });
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('Private');
    expect((await Opportunity.findById(ids.scholarship))?.numberOfAwards).toBe(1);
    expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(0);
  });
  it('fails closed when transaction support is unavailable', async () => {
    vi.spyOn(mongoose.connection, 'transaction').mockRejectedValueOnce(Object.assign(new Error('Private database configuration'), { code: 20 }));
    const result = await decide('accepted');
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('Private');
    expect((await Application.findById(first))?.status).toBe('applied');
  });
});
