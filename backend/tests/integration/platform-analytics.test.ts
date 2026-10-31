import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import Application from '../../src/models/Application';
import Resource from '../../src/models/Resource';
import ResourceRequest from '../../src/models/ResourceRequest';
import PromotionRequest from '../../src/models/PromotionRequest';
import { Mentorship } from '../../src/models/Mentorship';
import { ScholarshipAppeal, ScholarshipEvent } from '../../src/models/Scholarship';
import { ResourceDispute, ResourceEvent } from '../../src/models/ResourceActivity';
import Report from '../../src/models/Report';
import AuditLog from '../../src/models/AuditLog';
import { CommunityClaim } from '../../src/models/CommunityClaim';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { defaultScholarshipPolicy } from '../../src/services/scholarshipPolicy';
import { readPlatformAnalytics } from '../../src/services/platformAnalytics';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, applicationFixture, campaignFixture, ids, providerFixture, resourceFixture, resourceRequestFixture, scholarshipFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const start = new Date(Date.now() - 4 * 86400000); const middle = new Date(start.getTime() + 86400000); const end = new Date(start.getTime() + 2 * 86400000);
const range = { from: start.toISOString(), to: end.toISOString() };
let fixtureHash = '';
const token = (id: Types.ObjectId, version = 0) => generateToken(String(id), id.equals(ids.admin) ? 'admin' : [ids.student, ids.outsider].some(row => row.equals(id)) ? 'student' : 'provider', version);
const get = (id = ids.student, path = '/api/dashboard/analytics') => request(app).get(path).auth(token(id), { type: 'bearer' });
const summary = async (id = ids.student) => { const r = await get(id); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body.data; };
const listing = (changes = {}, owner = ids.provider) => Opportunity.create(scholarshipFixture({ _id: new Types.ObjectId(), providerId: owner, createdAt: middle, ...changes }));
const application = (source: { _id: Types.ObjectId; providerId: Types.ObjectId }, changes = {}) => Application.create(applicationFixture({ opportunityId: source._id, providerId: source.providerId, appliedAt: middle, ...changes }));
const resource = (changes = {}, owner = ids.provider) => Resource.create(resourceFixture({ _id: new Types.ObjectId(), listedBy: owner, createdAt: middle, quantityAvailable: 5, ...changes }));
const resourceRequest = (source: { _id: Types.ObjectId; listedBy: Types.ObjectId }, changes = {}) => ResourceRequest.create(resourceRequestFixture({ resourceId: source._id, providerId: source.listedBy, createdAt: middle, ...changes }));
const campaign = (changes = {}, owner = ids.provider) => PromotionRequest.create({ ...campaignFixture(), providerId: owner, createdAt: middle, ...changes });
const mentor = (changes = {}) => Mentorship.create({ studentId: ids.student, mentorId: ids.provider, revision: 1, topic: 'Private mentoring topic', message: 'Private student mentoring goals.', createdAt: middle, ...changes });
function privateFieldsAbsent(value: unknown) {
  const text = JSON.stringify(value);
  for (const field of ['justification', 'selfDeclaredNeed', 'priorityScore', 'password', 'tokenVersion', 'example.test', 'Private student', 'Private campaign', 'affiliationReference', 'decisionReason', 'resolutionNote', 'statement']) expect(text).not.toContain(field);
}
beforeAll(async () => { await database.start(); fixtureHash = await bcrypt.hash(testPassword, 12); });
beforeEach(async () => {
  await database.clear();
  // Valid synthetic hashes avoid repeating password hashing in metrics-only cases.
  // The isolated DB guard remains mandatory; normal auth/hash tests are unchanged.
  await User.insertMany([studentFixture(), studentFixture({ _id: ids.outsider, email: 'peer@example.test' }), providerFixture(), providerFixture({ _id: ids.lecturer, email: 'other-provider@example.test' }), adminFixture()].map(user => ({ ...user, password: fixtureHash, createdAt: middle })));
});
afterAll(() => database.stop());

describe('analytics sessions, scope and honest empty datasets', () => {
  it('requires a normal full session and denies cross-role endpoints', async () => {
    expect((await request(app).get('/api/dashboard/analytics')).status).toBe(401);
    expect((await request(app).get('/api/dashboard/analytics').auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
    for (const [id, path] of [[ids.student, 'admin'], [ids.provider, 'student'], [ids.admin, 'provider']] as const) expect((await get(id, `/api/dashboard/analytics/${path}`)).status).toBe(403);
    expect((await get(ids.student, '/api/provider/dashboard')).status).toBe(403);
    expect((await request(app).get('/api/dashboard/analytics/admin').auth(generateToken(String(ids.student), 'admin'), { type: 'bearer' })).status).toBe(403);
  });
  it.each(['student', 'provider', 'admin'] as const)('returns safe zero activity for an empty %s workspace', async role => {
    const id = role === 'student' ? ids.student : role === 'provider' ? ids.provider : ids.admin;
    const response = await get(id, `/api/dashboard/analytics/${role}`); expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    const data = response.body.data; expect(data).toMatchObject({ role, schemaVersion: 1, applications: { total: 0, accepted: 0 }, scholarships: { confirmedAwards: 0 }, resourceRequests: { total: 0, confirmedAllocations: 0 }, mentorship: { total: 0 }, campaigns: { total: 0 } });
    expect(Object.values(data.applications.byStatus).every(value => value === 0)).toBe(true); privateFieldsAbsent(data);
    if (role === 'admin') expect(data.accounts).toMatchObject({ total: 5, activeAccounts: 5, verifiedProviders: 2, byRole: { student: 2, provider: 2, admin: 1 } });
    else expect(data).not.toHaveProperty('accounts');
  });
  it('blocks unverified email, suspension, revoked tokens and withdrawn provider verification', async () => {
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await get()).status).toBe(403); expect((await get(ids.student, '/api/dashboard/stats')).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { emailVerifiedAt: new Date(), accountStatus: 'suspended' }); expect((await get()).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'active', tokenVersion: 1 }); expect((await get()).status).toBe(401);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false }); expect((await get(ids.provider)).status).toBe(403); expect((await get(ids.provider, '/api/provider/dashboard')).status).toBe(403);
  });
  it('reauthorizes the current snapshot account even when called after middleware', async () => {
    await User.updateOne({ _id: ids.admin }, { role: 'student', tokenVersion: 1 });
    await expect(readPlatformAnalytics({ id: ids.admin, role: 'admin', version: 0 }, {})).rejects.toMatchObject({ statusCode: 401 });
    await expect(readPlatformAnalytics({ id: ids.admin, role: 'admin', version: 1 }, {})).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each([{ ownerId: String(ids.admin) }, { providerId: String(ids.lecturer) }, { role: 'admin' }, { from: range.from }, { to: range.to }, { from: range.to, to: range.from }, { from: '2026-02-30T00:00:00.000Z', to: range.to }, { from: [range.from, range.from], to: range.to }])('rejects malformed windows and authority override filters %j', async query => expect((await get().query(query)).status).toBe(400));
  it('preserves the legacy impact response and useful empty-distribution behavior', async () => {
    const response = await get(ids.student, '/api/dashboard/stats'); expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ totalStudents: 1, totalOpenOpportunities: 0, totalApplications: 0, totalResourceListings: 0, applicationsByStatus: {}, resourceListingsByAccessType: {}, scope: 'self' });
    const provider = await get(ids.provider, '/api/provider/dashboard'); expect(provider.status).toBe(200); expect(provider.body.data).toMatchObject({ recentOpportunities: [], recentActivity: [], stats: { totalOpportunities: 0, applicationsReceived: 0, activeListings: 0, resourceCount: 0, studentsConnected: 0, views: 0, creatorCampaigns: 0 } });
  });
});

describe('application and scholarship calculations', () => {
  it('isolates each student and keeps accepted legacy scholarships separate from confirmed awards', async () => {
    const scholarship = await listing(); const job = await listing({ type: 'job' }); await application(scholarship, { status: 'accepted' }); await application(job); await application(scholarship, { studentId: ids.outsider, status: 'accepted' });
    const data = await summary(); expect(data.applications).toMatchObject({ total: 2, accepted: 1, byStatus: { accepted: 1, applied: 1 } }); expect(data.scholarships).toMatchObject({ applications: 1, confirmedAwards: 0, acceptedWithoutAwardRecord: 1 }); privateFieldsAbsent(data);
    const peer = await summary(ids.outsider); expect(peer.applications.total).toBe(1);
    const legacy = await get(ids.student, '/api/dashboard/stats'); expect(legacy.body.data.totalApplications).toBe(2); expect(legacy.body.data.applicationsByStatus).toEqual({ applied: 1, accepted: 1 });
  });
  it('counts a current recorded award once, rejects stale/wrong-actor decision evidence and never sums currencies', async () => {
    const source = await listing({ amount: 500, currency: 'USD' }); const row = await application(source, { status: 'accepted', awardedAt: middle, scholarshipRevision: 1 });
    await ScholarshipEvent.create({ applicationId: row._id, opportunityId: source._id, actorId: ids.provider, action: 'decision', toStatus: 'accepted', revision: 1, reason: 'Private recorded decision reason.', createdAt: middle });
    expect((await summary()).scholarships.confirmedAwards).toBe(1);
    await Application.updateOne({ _id: row._id }, { scholarshipRevision: 2 }); expect((await summary()).scholarships).toMatchObject({ confirmedAwards: 0, acceptedWithoutAwardRecord: 1 });
    await ScholarshipEvent.updateOne({}, { revision: 2, actorId: ids.admin }); expect((await summary()).scholarships.confirmedAwards).toBe(0);
    const data = await summary(ids.admin); expect(data.scholarships).not.toHaveProperty('amount'); privateFieldsAbsent(data);
  });
  it('recognizes the actual human scholarship decision workflow', async () => {
    const source = await listing(); const policy = defaultScholarshipPolicy(); policy.eligibility.requireEvidence = false;
    const configured = await request(app).put(`/api/scholarships/${source._id}/policy`).auth(token(ids.provider), { type: 'bearer' }).send({ ...policy, revision: 0, reason: 'Independent test policy configuration before submission.' }); expect(configured.status).toBe(200);
    const submitted = await request(app).post('/api/applications').auth(token(ids.student), { type: 'bearer' }).send({ opportunityId: String(source._id), justification: 'Synthetic need justification for a separately reviewed scholarship.', selfDeclaredNeed: 'medium' }); expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    const decided = await request(app).patch(`/api/applications/${submitted.body.data.application._id}/status`).auth(token(ids.provider), { type: 'bearer' }).send({ status: 'accepted', revision: 0, reason: 'Independent human review explicitly approved this scholarship.' }); expect(decided.status, JSON.stringify(decided.body)).toBe(200);
    expect((await summary()).scholarships.confirmedAwards).toBe(1); expect((await summary(ids.provider)).scholarships.confirmedAwards).toBe(1);
  });
  it('does not expose cross-owner, mismatched or orphaned applications to providers', async () => {
    const own = await listing(); const other = await listing({ title: 'Other owner private listing' }, ids.lecturer);
    await application(own); await application(other, { studentId: ids.outsider }); await application(other, { providerId: ids.provider });
    await Application.create(applicationFixture({ studentId: ids.outsider, opportunityId: new Types.ObjectId() }));
    const provider = await summary(ids.provider); expect(provider.applications.total).toBe(1);
    const legacy = await get(ids.provider, '/api/provider/dashboard'); expect(legacy.body.data.stats.applicationsReceived).toBe(1); expect(JSON.stringify(legacy.body)).not.toContain('Other owner private listing');
    const admin = await summary(ids.admin); expect(admin.applications).toMatchObject({ total: 4, unavailableSources: 2 });
  });
  it('reports unavailable student history without misclassifying it as scholarship benefit', async () => {
    await Application.create(applicationFixture({ opportunityId: new Types.ObjectId(), status: 'accepted', awardedAt: middle })); const data = await summary(); expect(data.applications).toMatchObject({ total: 1, accepted: 1, unavailableSources: 1 }); expect(data.scholarships.applications).toBe(0); expect(data.scholarships.confirmedAwards).toBe(0);
  });
});

describe('resource use, inventory and confirmed allocation history', () => {
  it('recognizes real allocation and return records without counting accepted-only legacy rows as confirmed', async () => {
    const source = await resource(); const row = await resourceRequest(source);
    const accepted = await request(app).patch(`/api/resource-requests/${row._id}/status`).auth(token(ids.provider), { type: 'bearer' }).send({ status: 'accepted' }); expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    const legacy = await resourceRequest(source, { studentId: ids.outsider, status: 'accepted' });
    const provider = await summary(ids.provider); expect(provider.resourceRequests).toMatchObject({ total: 2, confirmedAllocations: 1, currentAllocations: 1, acceptedWithoutAllocationRecord: 1, acceptedStudents: 2, allocatedStudents: 1 });
    expect((await summary(ids.outsider)).resourceRequests.confirmedAllocations).toBe(0);
    await ResourceRequest.updateOne({ _id: row._id }, { status: 'completed', returnedAt: middle, inventoryRestoredAt: middle }); expect((await summary()).resourceRequests).toMatchObject({ confirmedAllocations: 1, currentAllocations: 0, returnsConfirmed: 1 });
    await ResourceRequest.updateOne({ _id: legacy._id }, { allocation: { inventoryReserved: true, returnRequired: false, accessType: 'donation' } }); expect((await summary(ids.outsider)).resourceRequests.confirmedAllocations).toBe(0);
  });
  it('distinguishes available listing counts from whole units and excludes paused, empty, withdrawn, expired or ineligible owners', async () => {
    await resource({ quantityAvailable: 3 }); await resource({ quantityAvailable: 2 }); await resource({ quantityAvailable: 0 }); await resource({ availabilityPaused: true }); await resource({ withdrawnByAdmin: true });
    await resource({ accessDetails: { donation: { ...resourceFixture().accessDetails.donation, claimDeadline: middle } } }); await resource({ status: 'claimed' });
    await resource({}, ids.lecturer); await User.updateOne({ _id: ids.lecturer }, { accountStatus: 'suspended' });
    const provider = await summary(ids.provider); expect(provider.resources).toMatchObject({ totalListings: 7, availableListings: 2, availableUnits: 5 });
    const admin = await summary(ids.admin); expect(admin.resources).toMatchObject({ totalListings: 8, availableListings: 2, availableUnits: 5 });
    expect((await summary()).discovery.availableResourceListings).toBe(2);
  });
  it('prevents cross-owner resource counters and recent-activity metadata disclosure', async () => {
    const own = await resource(); const other = await resource({ itemName: 'Other private equipment' }, ids.lecturer); await resourceRequest(own); await resourceRequest(other, { providerId: ids.provider });
    expect((await summary(ids.provider)).resourceRequests.total).toBe(1); expect((await summary(ids.admin)).resourceRequests.unavailableSources).toBe(1);
    expect(JSON.stringify((await get(ids.provider, '/api/provider/dashboard')).body)).not.toContain('Other private equipment');
  });
  it('uses actual reserved return deadlines for overdue counts', async () => {
    const source = await resource(); const row = await resourceRequest(source, { status: 'accepted', allocation: { accessType: 'donation', inventoryReserved: true, returnRequired: true, dueAt: middle } });
    await ResourceEvent.create({ requestId: row._id, resourceId: source._id, actorId: ids.provider, action: 'accepted', toStatus: 'accepted' });
    expect((await summary()).resourceRequests.overdue).toBe(1); await ResourceRequest.updateOne({ _id: row._id }, { inventoryRestoredAt: middle }); expect((await summary()).resourceRequests.overdue).toBe(0);
  });
});

describe('opportunities, mentorship, creator campaigns and moderation', () => {
  it('derives expiry and withdrawal without mutating source records or counting inaccessible listings as public', async () => {
    await listing({ type: 'job', views: 5, applicationDeadline: new Date(Date.now() + 3 * 86400000) });
    const expired = await listing({ applicationDeadline: middle }); await listing({ status: 'draft' }); await listing({ opportunityWithdrawnByAdmin: true });
    await listing({}, ids.lecturer); await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verified': false });
    const provider = await summary(ids.provider); expect(provider.opportunities).toMatchObject({ total: 4, open: 1, discoverableOpen: 1, expiringSoon: 1, views: 5, byStatus: { draft: 1, open: 1, closed: 1, expired: 1 } });
    expect((await Opportunity.findById(expired._id))?.status).toBe('open'); expect((await summary()).discovery.openOpportunities).toBe(1);
    const impact = await get(ids.admin, '/api/dashboard/stats'); expect(impact.body.data.totalOpenOpportunities).toBe(1);
  });
  it('counts current mentorship activity without revealing topics, requests or appointment details', async () => {
    await mentor(); await mentor({ mentorId: ids.lecturer, status: 'scheduled', appointment: { startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 90000000) } }); await mentor({ status: 'completed' }); await mentor({ studentId: ids.outsider, mentorId: ids.lecturer, status: 'completed' });
    const data = await summary(); expect(data.mentorship).toMatchObject({ total: 3, active: 2, upcomingAppointments: 1, byStatus: { pending: 1, scheduled: 1, completed: 1 } }); privateFieldsAbsent(data);
    expect((await summary(ids.provider)).mentorship.total).toBe(2); expect((await summary(ids.admin)).mentorship.total).toBe(4);
  });
  it('maps real and legacy campaign stages, keeps unpublished drafts private, and limits each provider to their own campaigns', async () => {
    await campaign({ stage: 'draft', status: 'pending' }); await campaign({ stage: 'in_progress', status: 'accepted' }); await campaign({ status: 'accepted', deliveryStatus: 'submitted' }); await campaign({ status: 'completed' }); await campaign({ studentId: ids.outsider, status: 'pending' }, ids.lecturer);
    const student = await summary(); expect(student.campaigns).toMatchObject({ total: 3, active: 2, byStage: { draft: 0, in_progress: 1, submitted: 1, completed: 1 } });
    const provider = await summary(ids.provider); expect(provider.campaigns).toMatchObject({ total: 4, byStage: { draft: 1, in_progress: 1, submitted: 1, completed: 1 } });
    expect((await get(ids.provider, '/api/provider/dashboard')).body.data.stats.creatorCampaigns).toBe(4);
  });
  it.each([['not_submitted', 'accepted'], ['submitted', 'submitted'], ['changes_requested', 'changes_requested'], ['approved', 'reviewed']] as const)('maps legacy delivery state %s to recorded campaign stage %s', async (deliveryStatus, stage) => {
    await campaign({ status: 'accepted', deliveryStatus }); const data = await summary(ids.provider); expect(data.campaigns.total).toBe(1); expect(data.campaigns.byStage[stage]).toBe(1);
  });
  it('counts malformed legacy statuses as unknown without exposing arbitrary labels', async () => {
    const source = await listing(); await Application.collection.insertOne({ ...applicationFixture({ opportunityId: source._id }), status: 'Private legacy status label' });
    const data = await summary(); expect(data.applications).toMatchObject({ total: 1, byStatus: { unknown: 1 } }); expect(JSON.stringify(data)).not.toContain('Private legacy status label');
  });
  it('provides admin-only account, pending-request and moderation summaries without private content', async () => {
    const source = await listing(); const row = await application(source); const hardware = await resource(); const ticket = await resourceRequest(hardware, { status: 'waitlisted' }); await mentor(); await campaign({ status: 'pending' });
    await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'NEEDS_INFO' });
    await CommunityClaim.create({ providerId: ids.lecturer, directoryId: 'synthetic-analytics-directory', documentId: new Types.ObjectId(), institution: 'Test University', justification: 'Private student campus claim justification.', status: 'NEEDS_INFO', revision: 1, profile: { visibility: 'hidden', acceptsStudentMessages: false, expertise: [], availability: 'Unavailable', bio: 'Synthetic test profile, never a real directory identity.' }, createdAt: middle });
    await ScholarshipAppeal.create({ applicationId: row._id, opportunityId: source._id, studentId: ids.student, providerId: ids.provider, decisionRevision: 0, statement: 'Private student appeal statement kept out of analytics.', status: 'pending', createdAt: middle });
    await ResourceDispute.create({ resourceId: hardware._id, requestId: ticket._id, createdBy: ids.student, statement: 'Private student dispute statement kept out of analytics.', createdAt: middle });
    await Report.create({ reporterId: ids.student, targetId: new Types.ObjectId(), targetType: 'message', reason: 'Private complaint reason', createdAt: middle }); await Report.create({ reporterId: ids.student, targetId: source._id, targetType: 'opportunity', reason: 'Private complaint about listing', status: 'reviewed', createdAt: middle });
    await AuditLog.create({ adminId: ids.admin, action: 'private_internal_action', targetType: 'user', targetId: ids.provider, reason: 'Private reason never returned by analytics.', createdAt: middle });
    const data = await summary(ids.admin); expect(data.accounts).toMatchObject({ verifiedProviders: 1, providersAwaitingVerification: 1 }); expect(data.pendingRequests).toMatchObject({ applications: 1, resourceRequests: 1, mentorshipRequests: 1, creatorInvitations: 1, providerVerifications: 1, communityClaims: 1, scholarshipAppeals: 1, resourceDisputes: 1 }); expect(data.moderation).toMatchObject({ reports: 2, byStatus: { open: 1, reviewed: 1 }, byTarget: { message: 1, opportunity: 1 }, administrativeActions: 1 }); privateFieldsAbsent(data);
    expect(await summary()).not.toHaveProperty('moderation'); expect(await summary(ids.provider)).not.toHaveProperty('pendingReviews');
  });
});

describe('date cohorts, bounded queries, snapshot consistency and failures', () => {
  it('uses appliedAt, includes from and excludes to independently of updatedAt', async () => {
    const source = await listing(); await application(source, { appliedAt: start }); await application(source, { studentId: ids.outsider, appliedAt: end });
    const r = await get(ids.admin).query(range); expect(r.status).toBe(200); expect(r.body.data.applications.total).toBe(1); expect(r.body.data.filter).toMatchObject({ from: range.from, to: range.to, basis: 'record_creation', endExclusive: true });
    await Application.updateMany({}, { status: 'reviewed' }); const again = await get(ids.admin).query(range); expect(again.body.data.applications.byStatus.reviewed).toBe(1);
  });
  it('applies creation cohorts consistently across modules and returns genuine zeros for an empty window', async () => {
    await listing(); await resource(); await mentor(); await campaign();
    const window = { from: new Date(end.getTime() + 86400000).toISOString(), to: new Date(end.getTime() + 2 * 86400000).toISOString() };
    const r = await get(ids.admin).query(window); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ accounts: { total: 0 }, opportunities: { total: 0 }, resources: { totalListings: 0 }, mentorship: { total: 0 }, campaigns: { total: 0 } });
    const legacy = await get(ids.student, '/api/dashboard/stats').query(window); expect(legacy.body.data.totalStudents).toBe(0); expect(legacy.body.data.totalOpenOpportunities).toBe(0);
  });
  it('keeps provider recent arrays bounded and preserves all existing dashboard fields', async () => {
    for (let index = 0; index < 8; index++) { const source = await listing({ title: `Own listing ${index}`, views: index }); await application(source); }
    const response = await get(ids.provider, '/api/provider/dashboard'); expect(response.status).toBe(200); const data = response.body.data; expect(data.recentOpportunities).toHaveLength(4); expect(data.recentActivity).toHaveLength(6); expect(data.stats).toMatchObject({ totalOpportunities: 8, scholarships: 8, applicationsReceived: 8, views: 28 });
    for (const key of ['paidProjects', 'internships', 'trainingPrograms', 'mentorshipListings', 'acceptedApplications', 'studentsConnected', 'resourceRequestsReceived', 'pendingRequests', 'acceptedRequests', 'activeListings', 'resourceCount', 'resourceRequestsAccepted', 'resourceStudentsConnected', 'expiringSoon']) expect(typeof data.stats[key]).toBe('number'); privateFieldsAbsent(data);
  });
  it('does not write counters, identity, history, outbox or source status on reads', async () => {
    const source = await listing({ applicationDeadline: middle }); await application(source); const beforeUser = (await User.findById(ids.student).lean())!; const before = await Opportunity.findById(source._id).lean();
    await summary(); await summary(ids.provider); await summary(ids.admin); await get(ids.provider, '/api/provider/dashboard');
    expect(await User.findById(ids.student).lean()).toEqual(beforeUser); expect(await Opportunity.findById(source._id).lean()).toEqual(before); expect(await NotificationOutbox.countDocuments()).toBe(0); expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('keeps one consistent snapshot when a request is committed between module reads', async () => {
    const source = await resource(); const original = ResourceRequest.aggregate.bind(ResourceRequest);
    vi.spyOn(ResourceRequest, 'aggregate').mockImplementationOnce((...args) => {
      const aggregate = original(...args); const execute = aggregate.exec.bind(aggregate);
      vi.spyOn(aggregate, 'exec').mockImplementationOnce(async () => { await resourceRequest(source); return execute(); });
      return aggregate;
    });
    expect((await summary()).resourceRequests.total).toBe(0);
    expect((await summary()).resourceRequests.total).toBe(1);
  });
  it('fails closed with sanitized errors when an aggregate cannot complete', async () => {
    vi.spyOn(Application, 'aggregate').mockImplementationOnce(() => { throw new Error('Private database endpoint and credentials.'); }); const r = await get(); expect(r.status).toBe(503); expect(JSON.stringify(r.body)).not.toMatch(/credentials|endpoint/); expect(r.body).not.toHaveProperty('data'); expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('uses an indexed owner/date query plan without reading unrelated application records', async () => {
    const source = await listing(); await application(source); await Application.insertMany(Array.from({ length: 100 }, () => applicationFixture({ studentId: new Types.ObjectId(), opportunityId: source._id, appliedAt: middle })));
    const plan = await Application.find({ studentId: ids.student, appliedAt: { $gte: start, $lt: end } }).explain('executionStats') as unknown as { queryPlanner: { winningPlan: unknown }; executionStats: { totalDocsExamined: number } };
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('IXSCAN'); expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(2); expect((await get().query(range)).body.data.applications.total).toBe(1);
  });
});
