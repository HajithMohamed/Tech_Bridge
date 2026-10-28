import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import Resource from '../../src/models/Resource';
import ResourceRequest from '../../src/models/ResourceRequest';
import { ResourceDispute, ResourceEvent } from '../../src/models/ResourceActivity';
import AuditLog from '../../src/models/AuditLog';
import User from '../../src/models/User';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, resourceFixture, resourceRequestFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const db = new TestDatabase();
const auth = (id = ids.student) => `Bearer ${generateToken(String(id), 'student')}`;
const base = { resourceId: String(ids.resource), requestedAccessType: 'donation', justification: 'I need this equipment for a synthetic university project.', selfDeclaredNeed: 'high' };
const reason = 'Reviewed the synthetic allocation and confirmed the physical item.';
const submit = (body: Record<string, unknown> = {}, actor = ids.student) => request(app).post('/api/resource-requests').set('Authorization', auth(actor)).send({ ...base, ...body });
const status = (id: string, value: string, actor = ids.provider, body: Record<string, unknown> = {}) => request(app).patch(`/api/resource-requests/${id}/status`).set('Authorization', auth(actor)).send({ status: value, ...body });
const action = (id: string, path: string, actor: Types.ObjectId, body: Record<string, unknown>) => request(app).post(`/api/resource-requests/${id}/${path}`).set('Authorization', auth(actor)).send(body);
const get = (path: string, actor = ids.student) => request(app).get(path).set('Authorization', auth(actor));
const itemPath = `/api/resources/${ids.resource}`;
const inventory = (body: Record<string, unknown>, actor = ids.provider) => request(app).patch(`${itemPath}/inventory`).set('Authorization', auth(actor)).send(body);
const createId = async (body: Record<string, unknown> = {}, actor = ids.student) => { const response = await submit(body, actor); expect(response.status).toBe(201); return response.body.data.request._id as string; };
async function loan() { await Resource.updateOne({ _id: ids.resource }, { listedBy: ids.outsider, accessType: 'borrow', accessDetails: { borrowShare: { borrowDurationDays: 7, pickupLocation: 'Test campus', returnCondition: 'Good condition' } } }); }
async function acceptedLoan() { await loan(); const id = await createId({ requestedAccessType: 'borrow' }); expect((await status(id, 'accepted', ids.outsider)).status).toBe(200); return id; }
const stock = async (quantity: number, state = quantity ? 'available' : 'claimed') => expect(await Resource.findById(ids.resource).lean()).toMatchObject({ quantityAvailable: quantity, status: state });

beforeAll(() => db.start());
beforeEach(async () => {
  await db.clear(); await User.create([studentFixture(), providerFixture(), studentFixture({ _id: ids.outsider, email: 'resource-owner@example.test' }), adminFixture()]);
  await Resource.create(resourceFixture());
});
afterAll(() => db.stop());

describe('resource submission, allocation and queues', () => {
  it('creates a server-owned snapshot and ignores applicant-supplied allocation authority', async () => {
    const response = await submit({ lifecycleVersion: 0, status: 'accepted', providerId: ids.admin, revision: 90, allocation: { returnRequired: false }, prioritySnapshot: { priorityScore: 100 } });
    expect(response.status).toBe(201); const row = response.body.data.request;
    expect(row).toMatchObject({ lifecycleVersion: 1, status: 'pending', providerId: String(ids.provider), revision: 0 });
    expect(row.allocation).toBeUndefined(); expect(row.prioritySnapshot.priorityReasons.join(' ')).toContain('self-declared');
    expect(await ResourceEvent.countDocuments({ requestId: row._id, action: 'submitted' })).toBe(1); await stock(1);
  });
  it('serializes concurrent category submissions across different listings', async () => {
    const second = new Types.ObjectId(); await Resource.create(resourceFixture({ _id: second }));
    const responses = await Promise.all([submit(), submit({ resourceId: String(second) })]);
    expect(responses.map(row => row.status).sort()).toEqual([201, 409]); expect(await ResourceRequest.countDocuments()).toBe(1);
  });
  it('validates IDs, terms, ownership, waitlist flags and dates without partial requests', async () => {
    for (const body of [{ resourceId: { $ne: null } }, { message: {} }, { durationOrTerms: [] }, { justification: '<script>malicious input long enough here</script>' }, { joinWaitlist: 'yes' }, { requestedStartAt: 'tomorrow' }]) expect((await submit(body)).status).toBe(400);
    expect((await submit({}, ids.provider)).status).toBe(403);
    await Resource.updateOne({ _id: ids.resource }, { listedBy: ids.student }); expect((await submit()).status).toBe(400);
    expect(await ResourceRequest.countDocuments()).toBe(0);
  });
  it('rolls back request creation and actor locks when audit persistence fails', async () => {
    vi.spyOn(ResourceEvent, 'create').mockImplementationOnce(() => { throw new Error('Private audit failure'); });
    const response = await submit(); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('Private');
    expect(await ResourceRequest.countDocuments()).toBe(0); expect((await User.findById(ids.student))?.__v).toBe(0); await stock(1);
  });
  it('rejects expired and paused listings, even when the student asks to wait', async () => {
    await Resource.updateOne({ _id: ids.resource }, { 'accessDetails.donation.claimDeadline': new Date('2000-01-01') }); expect((await submit()).status).toBe(409);
    await Resource.updateOne({ _id: ids.resource }, { 'accessDetails.donation.claimDeadline': new Date('2099-01-01'), availabilityPaused: true }); expect((await submit({ joinWaitlist: true })).status).toBe(409);
    expect(await ResourceRequest.countDocuments()).toBe(0);
  });
  it('records explicit owner waitlisting, stable ordering and a human priority override', async () => {
    const first = await createId(); expect((await status(first, 'waitlisted', ids.provider)).status).toBe(400);
    expect((await status(first, 'waitlisted', ids.provider, { reason, revision: 0 })).status).toBe(200);
    const second = await createId({ joinWaitlist: true, selfDeclaredNeed: 'low' }, ids.outsider);
    const queue = await get(`${itemPath}/waitlist`, ids.provider); expect(queue.status).toBe(200);
    expect(queue.body.data.requests.map((row: { _id: string }) => row._id)).toEqual([first, second]);
    const advance = (extra: Record<string, unknown>) => request(app).post(`${itemPath}/waitlist/advance`).set('Authorization', auth(ids.provider)).send({ requestId: second, revision: 0, reason, ...extra });
    expect((await advance({})).status).toBe(409); expect((await advance({ priorityOverrideReason: 'Human review identified a documented urgent equipment requirement.' })).status).toBe(200);
    expect((await ResourceRequest.findById(first))?.status).toBe('waitlisted'); await stock(0);
    expect((await ResourceEvent.findOne({ requestId: second, action: 'accepted' }))?.priorityOverrideReason).toContain('urgent');
  });
  it('allows explicit waiting on depleted stock and advances only once after restocking', async () => {
    await Resource.updateOne({ _id: ids.resource }, { quantityAvailable: 0, status: 'claimed' });
    expect((await submit()).status).toBe(404); const id = await createId({ joinWaitlist: true });
    expect((await inventory({ quantityAvailable: 1 })).status).toBe(200);
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(app).post(`${itemPath}/waitlist/advance`).set('Authorization', auth(ids.provider)).send({ requestId: id, revision: 0, reason })));
    expect(responses.map(row => row.status).sort()).toEqual([200, 409, 409]); await stock(0);
  });
  it('cancels only unallocated requests and does not alter inventory', async () => {
    const id = await createId(); expect((await action(id, 'cancel', ids.outsider, { revision: 0, reason })).status).toBe(404);
    expect((await action(id, 'cancel', ids.student, { revision: 0, reason })).status).toBe(200);
    expect((await status(id, 'accepted')).status).toBe(409); await stock(1);
    expect((await ResourceRequest.findById(id))?.status).toBe('cancelled'); expect((await createId()).length).toBe(24);
  });
  it('rechecks deadline, account eligibility and stale decisions before allocating', async () => {
    const id = await createId(); expect((await status(id, 'accepted', ids.provider, { revision: 5 })).status).toBe(409);
    await Resource.updateOne({ _id: ids.resource }, { 'accessDetails.donation.claimDeadline': new Date('2000-01-01') }); expect((await status(id, 'accepted')).status).toBe(409);
    await Resource.updateOne({ _id: ids.resource }, { 'accessDetails.donation.claimDeadline': new Date('2099-01-01') }); await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' }); expect((await status(id, 'accepted')).status).toBe(409); await stock(1);
  });
  it.each(['donation', 'sponsorship', 'installment', 'interest_free'])('completes the %s ownership transfer without inventing returned stock', async accessType => {
    await Resource.updateOne({ _id: ids.resource }, { accessType }); const id = await createId({ requestedAccessType: accessType });
    expect((await status(id, 'accepted')).status).toBe(200); expect((await status(id, 'completed')).status).toBe(200); await stock(0);
    expect((await action(id, 'return', ids.student, { revision: 2, reason })).status).toBe(409); expect((await ResourceRequest.findById(id))?.inventoryRestoredAt).toBeUndefined();
  });
});

describe('physical returns and inventory integrity', () => {
  it.each(['rent', 'sponsorship'])('restores physical %s property only when its actual policy requires return', async accessType => {
    await Resource.updateOne({ _id: ids.resource }, { accessType, returnPolicy: 'returnable', ...(accessType === 'sponsorship' ? { returnDurationDays: 30 } : { accessDetails: { rent: { minRentalMonths: 1, pricePerMonth: 0, currency: 'LKR' } } }) });
    const id = await createId({ requestedAccessType: accessType }); expect((await get(`/api/resource-requests/${id}`)).body.data.request.returnConfirmationRequired).toBe(true);
    expect((await status(id, 'accepted')).status).toBe(200); expect((await status(id, 'completed')).status).toBe(409);
    expect((await action(id, 'return', ids.student, { revision: 1, reason })).status).toBe(200); expect((await action(id, 'return/confirm', ids.provider, { revision: 2, reason })).status).toBe(200); await stock(1);
  });
  it('requires borrower initiation and owner confirmation before restoring exactly one unit', async () => {
    const id = await acceptedLoan(); await stock(0);
    expect((await status(id, 'completed', ids.outsider)).status).toBe(409);
    expect((await action(id, 'return/confirm', ids.outsider, { revision: 1, reason })).status).toBe(409);
    expect((await action(id, 'return', ids.outsider, { revision: 1, reason })).status).toBe(403);
    expect((await action(id, 'return', ids.student, { revision: 1, reason })).status).toBe(200); await stock(0);
    expect((await action(id, 'return/confirm', ids.student, { revision: 2, reason })).status).toBe(404);
    const responses = await Promise.all(Array.from({ length: 4 }, () => action(id, 'return/confirm', ids.outsider, { revision: 2, reason })));
    expect(responses.map(row => row.status).sort()).toEqual([200, 409, 409, 409]); await stock(1);
    expect(await ResourceRequest.findById(id).lean()).toMatchObject({ status: 'completed', revision: 3 });
    expect(await ResourceEvent.countDocuments({ requestId: id, action: 'return_confirmed' })).toBe(1);
    const row = await ResourceRequest.findById(id); expect(row?.returnedAt).toEqual(row?.inventoryRestoredAt);
  });
  it('rolls back restoration, completion and actor locks when the return audit fails', async () => {
    const id = await acceptedLoan(); await action(id, 'return', ids.student, { revision: 1, reason });
    vi.spyOn(ResourceEvent, 'create').mockImplementationOnce(() => { throw new Error('Private return audit failure'); });
    const response = await action(id, 'return/confirm', ids.outsider, { revision: 2, reason }); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('Private');
    await stock(0); expect(await ResourceRequest.findById(id).lean()).toMatchObject({ status: 'accepted', revision: 2 }); expect((await ResourceRequest.findById(id))?.inventoryRestoredAt).toBeUndefined();
  });
  it('keeps a deliberately paused listing closed after a real return', async () => {
    const id = await acceptedLoan(); expect((await request(app).patch(`${itemPath}/status`).set('Authorization', auth(ids.outsider)).send({ status: 'claimed' })).status).toBe(200);
    await action(id, 'return', ids.student, { revision: 1, reason }); expect((await action(id, 'return/confirm', ids.outsider, { revision: 2, reason })).status).toBe(200); await stock(1, 'claimed');
    expect((await request(app).patch(`${itemPath}/status`).set('Authorization', auth(ids.outsider)).send({ status: 'available' })).status).toBe(200); await stock(1);
  });
  it('reports overdue from stored deadlines without changing inventory on reads', async () => {
    const id = await acceptedLoan(); await ResourceRequest.updateOne({ _id: id }, { 'allocation.startAt': new Date('2000-01-01'), 'allocation.dueAt': new Date('2000-01-08') });
    expect((await get(`/api/resource-requests/${id}`)).body.data.request.isOverdue).toBe(true);
    const mine = await get('/api/resource-requests/mine'); expect(mine.body.data.requests[0].isOverdue).toBe(true); await stock(0);
    await action(id, 'return', ids.student, { revision: 1, reason }); await action(id, 'return/confirm', ids.outsider, { revision: 2, reason }); expect((await get(`/api/resource-requests/${id}`)).body.data.request.isOverdue).toBe(false);
  });
  it('records future reservations, rejects early returns and validates deadline bounds', async () => {
    await loan(); const startAt = new Date(Date.now() + 86_400_000).toISOString(); const dueAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    expect((await submit({ requestedAccessType: 'borrow', requestedStartAt: startAt, requestedReturnAt: new Date(Date.now() + 30 * 86_400_000).toISOString() })).status).toBe(400);
    const id = await createId({ requestedAccessType: 'borrow', requestedStartAt: startAt, requestedReturnAt: dueAt }); expect((await status(id, 'accepted', ids.outsider)).status).toBe(200);
    const row = await ResourceRequest.findById(id); expect(row?.allocation?.startAt?.toISOString()).toBe(startAt); expect(row?.allocation?.dueAt?.toISOString()).toBe(dueAt);
    expect((await action(id, 'return', ids.student, { revision: 1, reason })).status).toBe(409); await stock(0);
  });
  it('does not reassign restored stock automatically to waitlisted applicants', async () => {
    const id = await acceptedLoan(); await User.create(studentFixture({ _id: ids.lecturer, email: 'waiting@example.test' }));
    const waiting = await createId({ requestedAccessType: 'borrow', joinWaitlist: true }, ids.lecturer);
    await action(id, 'return', ids.student, { revision: 1, reason }); await action(id, 'return/confirm', ids.outsider, { revision: 2, reason });
    await stock(1); expect((await ResourceRequest.findById(waiting))?.status).toBe('waitlisted');
  });
  it('requires explicit owner attestation for a historical unsnapshotted reservation', async () => {
    await loan(); const row = await ResourceRequest.create(resourceRequestFixture({ providerId: ids.outsider, requestedAccessType: 'borrow', status: 'accepted' }));
    await Resource.updateOne({ _id: ids.resource }, { quantityAvailable: 0, status: 'claimed' });
    expect((await action(String(row._id), 'return', ids.student, { revision: 0, reason })).status).toBe(200);
    expect((await action(String(row._id), 'return/confirm', ids.outsider, { revision: 1, reason })).status).toBe(409); await stock(0);
    expect((await action(String(row._id), 'return/confirm', ids.outsider, { revision: 1, reason, confirmLegacyReservation: true })).status).toBe(200); await stock(1);
    expect((await ResourceEvent.findOne({ requestId: row._id, action: 'return_confirmed' }))?.legacyReservationConfirmed).toBe(true);
  });
  it('requires revision and reason to adjust free stock while allocations are active', async () => {
    const id = await createId(); await status(id, 'accepted');
    expect((await inventory({ quantityAvailable: 2 })).status).toBe(400);
    expect((await inventory({ quantityAvailable: 2, inventoryRevision: 0, reason })).status).toBe(409);
    expect((await inventory({ quantityAvailable: 2, inventoryRevision: 1, reason })).status).toBe(200); await stock(2);
    expect((await inventory({ quantityAvailable: -1, inventoryRevision: 2, reason })).status).toBe(400);
    const history = await get(`${itemPath}/history`, ids.provider); expect(history.body.data.events[0]).toMatchObject({ action: 'inventory_adjusted', quantityBefore: 0, quantityAfter: 2, reason });
  });
  it('serializes a return against a concurrent free-inventory adjustment without losing either write', async () => {
    const id = await acceptedLoan(); await action(id, 'return', ids.student, { revision: 1, reason });
    const responses = await Promise.all([action(id, 'return/confirm', ids.outsider, { revision: 2, reason }), inventory({ quantityAvailable: 5, inventoryRevision: 1, reason }, ids.outsider)]);
    expect(responses[0].status).toBe(200);
    if (responses[1].status === 200) await stock(6); else { expect(responses[1].status).toBe(409); await stock(1); }
  });
  it('refuses restoration if source ownership, category or reservation policy was changed', async () => {
    const id = await acceptedLoan(); await action(id, 'return', ids.student, { revision: 1, reason }); await Resource.updateOne({ _id: ids.resource }, { accessType: 'donation' });
    expect((await action(id, 'return/confirm', ids.outsider, { revision: 2, reason })).status).toBe(409); await stock(0);
  });
});

describe('scoped disputes, privacy and retained allocation history', () => {
  it('records confidential disputes, blocks allocation completion and audits resolution without touching inventory', async () => {
    const id = await acceptedLoan(); const response = await action(id, 'disputes', ids.student, { revision: 1, statement: 'Synthetic confidential complaint about the physical equipment condition.' });
    expect(response.status).toBe(201); const disputeId = response.body.data.dispute._id;
    expect((await action(id, 'return', ids.student, { revision: 2, reason })).status).toBe(409);
    expect((await get(`/api/resource-requests/${id}/disputes`, ids.provider)).status).toBe(404);
    expect((await action(id, `disputes/${disputeId}/resolve`, ids.student, { revision: 2, status: 'resolved', reason })).status).toBe(403);
    expect((await action(id, `disputes/${disputeId}/resolve`, ids.outsider, { revision: 2, status: 'resolved', reason })).status).toBe(200); await stock(0);
    const history = await get(`/api/resource-requests/${id}/history`); expect(JSON.stringify(history.body)).not.toContain('confidential complaint'); expect(history.body.data.events.some((row: { disputeId: string }) => row.disputeId === disputeId)).toBe(true);
    expect((await action(id, 'return', ids.student, { revision: 3, reason })).status).toBe(200);
  });
  it('allows only one open dispute under concurrency and only its creator may withdraw it', async () => {
    const id = await acceptedLoan(); const responses = await Promise.all([1, 2].map(() => action(id, 'disputes', ids.student, { revision: 1, statement: 'Synthetic complaint detailed enough for an isolated dispute record.' })));
    expect(responses.map(row => row.status).sort()).toEqual([201, 409]); expect(await ResourceDispute.countDocuments()).toBe(1); const dispute = await ResourceDispute.findOne();
    expect((await action(id, `disputes/${dispute!._id}/resolve`, ids.outsider, { revision: 2, status: 'withdrawn', reason })).status).toBe(403);
    expect((await action(id, `disputes/${dispute!._id}/resolve`, ids.student, { revision: 2, status: 'withdrawn', reason })).status).toBe(200);
  });
  it('bounds repeat disputes and rolls back a failed dispute audit', async () => {
    const id = await acceptedLoan();
    vi.spyOn(ResourceEvent, 'create').mockImplementationOnce(() => { throw new Error('Private dispute audit failure'); });
    expect((await action(id, 'disputes', ids.student, { revision: 1, statement: 'Synthetic dispute statement which must be rolled back with its audit.' })).status).toBe(503);
    expect(await ResourceDispute.countDocuments()).toBe(0); expect((await ResourceRequest.findById(id))?.revision).toBe(1);
    for (let index = 0; index < 3; index++) {
      const opened = await action(id, 'disputes', ids.student, { revision: 1 + index * 2, statement: 'Synthetic repeated dispute limited by the server to three total cases.' }); expect(opened.status).toBe(201);
      expect((await action(id, `disputes/${opened.body.data.dispute._id}/resolve`, ids.student, { revision: 2 + index * 2, status: 'withdrawn', reason })).status).toBe(200);
    }
    expect((await action(id, 'disputes', ids.student, { revision: 7, statement: 'Synthetic fourth dispute must be rejected by the documented case limit.' })).status).toBe(409); await stock(0);
  });
  it('rejects outsider/admin access to private requests, histories, disputes and queues', async () => {
    const id = await createId();
    for (const actor of [ids.outsider, ids.admin]) for (const path of [`/api/resource-requests/${id}`, `/api/resource-requests/${id}/history`, `/api/resource-requests/${id}/disputes`, `${itemPath}/waitlist`, `${itemPath}/history`]) expect((await get(path, actor)).status).toBe(404);
    expect((await request(app).get(`/api/resource-requests/${id}/history`)).status).toBe(401);
    expect((await get(`/api/resource-requests/${id}/history?page=0`)).status).toBe(400);
    expect((await get(`/api/resource-requests/${id}/history`)).headers['cache-control']).toBe('no-store');
  });
  it('blocks provider deletion once requests exist and retains records on administrative removal', async () => {
    const id = await createId(); expect((await request(app).delete(itemPath).set('Authorization', auth(ids.provider))).status).toBe(409);
    expect((await request(app).delete(`/api/admin/resources/${ids.resource}`).set('Authorization', auth(ids.admin)).send({ reason })).status).toBe(200);
    expect(await Resource.findById(ids.resource).lean()).toMatchObject({ withdrawnByAdmin: true, status: 'claimed' }); expect((await get(itemPath)).status).toBe(404);
    expect((await status(id, 'accepted')).status).toBe(409); expect((await inventory({ quantityAvailable: 5 })).status).toBe(409);
    expect((await get(`/api/resource-requests/${id}/history`)).status).toBe(200); expect(await AuditLog.countDocuments({ action: 'resource_withdrawn_with_history' })).toBe(1);
  });
  it('allows genuine returns after moderation while keeping the source listing hidden', async () => {
    const id = await acceptedLoan(); await request(app).delete(`/api/admin/resources/${ids.resource}`).set('Authorization', auth(ids.admin)).send({ reason });
    await action(id, 'return', ids.student, { revision: 1, reason }); expect((await action(id, 'return/confirm', ids.outsider, { revision: 2, reason })).status).toBe(200); await stock(1, 'claimed');
    expect((await get(itemPath)).status).toBe(404); expect((await submit({ requestedAccessType: 'borrow', joinWaitlist: true })).status).toBe(409);
  });
  it('rolls back moderated withdrawal when the administrative audit cannot commit', async () => {
    await createId(); vi.spyOn(AuditLog, 'create').mockImplementationOnce(() => { throw new Error('Private administrative audit failure'); });
    const response = await request(app).delete(`/api/admin/resources/${ids.resource}`).set('Authorization', auth(ids.admin)).send({ reason }); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('Private');
    expect((await Resource.findById(ids.resource))?.withdrawnByAdmin).toBe(false); await stock(1); expect(await ResourceEvent.countDocuments({ action: 'withdrawn_with_history' })).toBe(0);
  });
  it('keeps provider applicant feeds scoped to current ownership and tolerates deleted students', async () => {
    const id = await createId(); await User.deleteOne({ _id: ids.student }); const response = await get('/api/resource-requests/provider', ids.provider); expect(response.status).toBe(200); expect(response.body.data.requests[0].studentId).toBeNull();
    await Resource.updateOne({ _id: ids.resource }, { listedBy: ids.outsider }); expect((await get('/api/resource-requests/provider', ids.provider)).body.data.requests).toEqual([]); expect((await ResourceRequest.findById(id))?.status).toBe('pending');
  });
});
