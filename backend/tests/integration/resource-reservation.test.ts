import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Resource from '../../src/models/Resource';
import ResourceRequest from '../../src/models/ResourceRequest';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { ids, providerFixture, resourceFixture, resourceRequestFixture, studentFixture } from '../support/fixtures';

const app = createApp();
const database = new TestDatabase();
const requestId = new Types.ObjectId('000000000000000000000021');
const secondRequestId = new Types.ObjectId('000000000000000000000022');
const secondResourceId = new Types.ObjectId('000000000000000000000023');
const bearer = (id = ids.provider, role = 'provider') => `Bearer ${generateToken(id.toString(), role)}`;
const decide = (status: unknown, id = requestId, owner = ids.provider) => request(app)
  .patch(`/api/resource-requests/${id}/status`).set('Authorization', bearer(owner)).send({ status });

beforeAll(() => database.start());
beforeEach(async () => {
  await database.clear();
  await User.create([providerFixture(), studentFixture(), studentFixture({ _id: ids.outsider, email: 'outsider@example.test' })]);
  await Resource.create(resourceFixture({ quantityAvailable: 2 }));
  await ResourceRequest.create(resourceRequestFixture({ _id: requestId }));
});
afterAll(() => database.stop());

async function expectStock(quantity: number, status: string = quantity ? 'available' : 'claimed', resourceId = ids.resource) {
  expect(await Resource.findById(resourceId).lean()).toMatchObject({ quantityAvailable: quantity, status });
}

describe('atomic resource reservation API on a real MongoDB replica set', () => {
  it('accepts once, consumes one unit and preserves the success contract', async () => {
    const studentBefore = await User.findById(ids.student).lean();
    const response = await decide('accepted');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { request: { _id: requestId.toString(), status: 'accepted' } } });
    await expectStock(1);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('accepted');
    expect(await User.findById(ids.student).lean()).toEqual({ ...studentBefore, __v: 1 });
  });

  it('allows only one winner when six approvals race for the same request', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => decide('accepted')));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(5);
    await expectStock(1);
    expect(await ResourceRequest.countDocuments({ status: 'accepted' })).toBe(1);
  });

  it('allocates the last unit to only one of two competing students', async () => {
    await Resource.updateOne({ _id: ids.resource }, { quantityAvailable: 1 });
    await ResourceRequest.create(resourceRequestFixture({ _id: secondRequestId, studentId: ids.outsider }));
    const responses = await Promise.all([decide('accepted'), decide('accepted', secondRequestId)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    await expectStock(0);
    expect(await ResourceRequest.countDocuments({ status: 'accepted' })).toBe(1);
    expect(await ResourceRequest.countDocuments({ status: 'pending' })).toBe(1);
  });

  it('allows both different students to reserve when two units are available', async () => {
    await ResourceRequest.create(resourceRequestFixture({ _id: secondRequestId, studentId: ids.outsider }));
    const responses = await Promise.all([decide('accepted'), decide('accepted', secondRequestId)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expectStock(0);
    expect(await ResourceRequest.countDocuments({ status: 'accepted' })).toBe(2);
  });

  it('serializes same-student category checks even across different owners and resources', async () => {
    await User.create(providerFixture({ _id: ids.lecturer, email: 'second-owner@example.test' }));
    await Resource.create(resourceFixture({ _id: secondResourceId, listedBy: ids.lecturer }));
    await ResourceRequest.create(resourceRequestFixture({ _id: secondRequestId, resourceId: secondResourceId, providerId: ids.lecturer }));
    const responses = await Promise.all([decide('accepted'), decide('accepted', secondRequestId, ids.lecturer)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await ResourceRequest.countDocuments({ studentId: ids.student, resourceCategory: 'other', status: 'accepted' })).toBe(1);
    const stock = await Resource.find({ _id: { $in: [ids.resource, secondResourceId] } });
    expect(stock.reduce((sum, resource) => sum + resource.quantityAvailable, 0)).toBe(2);
    expect((await User.findById(ids.student))?.__v).toBe(1);
  });

  it('allows the same student to receive different categories without a false conflict', async () => {
    await Resource.create(resourceFixture({ _id: secondResourceId, category: 'sensor', itemDetails: { sensor: { sensorType: 'Test', measuredParameter: 'Temperature', operatingVoltage: '3.3V', interface: 'I2C' } } }));
    await ResourceRequest.create(resourceRequestFixture({ _id: secondRequestId, resourceId: secondResourceId, resourceCategory: 'sensor' }));
    const responses = await Promise.all([decide('accepted'), decide('accepted', secondRequestId)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await ResourceRequest.countDocuments({ studentId: ids.student, status: 'accepted' })).toBe(2);
    await expectStock(1);
    await expectStock(0, 'claimed', secondResourceId);
  });

  it('commits only one decision when acceptance races with rejection', async () => {
    const responses = await Promise.all([decide('accepted'), decide('rejected')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const stored = await ResourceRequest.findById(requestId);
    expect(['accepted', 'rejected']).toContain(stored?.status);
    await expectStock(stored?.status === 'accepted' ? 1 : 2);
  });

  it('rolls back stock, claimed state and coordination if saving the decision fails', async () => {
    await Resource.updateOne({ _id: ids.resource }, { quantityAvailable: 1 });
    vi.spyOn(ResourceRequest, 'findOneAndUpdate').mockImplementationOnce(() => { throw new Error('Injected private database failure'); });
    const response = await decide('accepted');
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('Injected');
    await expectStock(1);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
    expect((await User.findById(ids.student))?.__v).toBe(0);
  });

  it.each([
    { quantityAvailable: 0 },
    { status: 'claimed' },
    { listedBy: ids.outsider },
    { accessType: 'share' },
    { category: 'sensor' },
  ])('refuses an unavailable or changed resource: %j', async (change) => {
    await Resource.updateOne({ _id: ids.resource }, change);
    const before = await Resource.findById(ids.resource).lean();
    expect((await decide('accepted')).status).toBe(409);
    expect(await Resource.findById(ids.resource).lean()).toEqual(before);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
    expect((await User.findById(ids.student))?.__v).toBe(0);
  });

  it('rejects missing resource records without changing the request', async () => {
    await Resource.deleteOne({ _id: ids.resource });
    expect((await decide('accepted')).status).toBe(409);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
  });

  it.each(['suspended', 'deleted'])('does not allocate to a %s student', async (state) => {
    if (state === 'deleted') await User.deleteOne({ _id: ids.student });
    else await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' });
    expect((await decide('accepted')).status).toBe(409);
    await expectStock(2);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
  });

  it('enforces ownership and authentication without changing stock', async () => {
    expect((await decide('accepted', requestId, ids.outsider)).status).toBe(404);
    expect((await decide('accepted', requestId, ids.student)).status).toBe(404);
    expect((await request(app).patch(`/api/resource-requests/${requestId}/status`).send({ status: 'accepted' })).status).toBe(401);
    await expectStock(2);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
  });

  it('keeps student owners able to approve requests for their shared listings', async () => {
    await Resource.updateOne({ _id: ids.resource }, { listedBy: ids.outsider, accessType: 'share' });
    await ResourceRequest.updateOne({ _id: requestId }, { providerId: ids.outsider, requestedAccessType: 'share' });
    const response = await decide('accepted', requestId, ids.outsider);
    expect(response.status).toBe(200);
    await expectStock(1);
  });

  it('rejects then refuses to reopen without consuming stock', async () => {
    expect((await decide('rejected')).status).toBe(200);
    expect((await decide('accepted')).status).toBe(409);
    expect((await decide('completed')).status).toBe(409);
    await expectStock(2);
  });

  it('requires acceptance before completion and keeps completion from replenishing stock', async () => {
    expect((await decide('completed')).status).toBe(409);
    expect((await decide('accepted')).status).toBe(200);
    expect((await decide('rejected')).status).toBe(409);
    const responses = await Promise.all([decide('completed'), decide('completed')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('completed');
    await expectStock(1);
  });

  it('rejects malformed IDs and unknown statuses without writes', async () => {
    expect((await request(app).patch('/api/resource-requests/not-an-id/status').set('Authorization', bearer()).send({ status: 'accepted' })).status).toBe(400);
    expect((await decide('pending')).status).toBe(400);
    expect((await decide({ malicious: 'accepted' })).status).toBe(400);
    expect((await request(app).patch(`/api/resource-requests/${requestId}/status`).set('Authorization', bearer())).status).toBe(400);
    expect((await decide('accepted', secondRequestId)).status).toBe(404);
    await expectStock(2);
  });

  it('fails closed when transactions are unavailable instead of attempting partial writes', async () => {
    vi.spyOn(mongoose.connection, 'transaction').mockRejectedValueOnce(Object.assign(new Error('Private standalone configuration'), { code: 20 }));
    const response = await decide('accepted');
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('Private');
    await expectStock(2);
    expect((await ResourceRequest.findById(requestId))?.status).toBe('pending');
  });
});
