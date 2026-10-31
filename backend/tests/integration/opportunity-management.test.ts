import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import Application from '../../src/models/Application';
import { ApplicationEvent, SavedOpportunity } from '../../src/models/OpportunityActivity';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import Notification from '../../src/models/Notification';
import { defaultOpportunityEligibility } from '../../src/services/opportunityPolicy';
import { enqueueNotificationReminders } from '../../src/services/notificationReminders';
import { runNotificationBatch } from '../../src/services/notificationDelivery';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { removeScholarshipAwareListing } from '../../src/services/scholarships';
import { TestDatabase } from '../support/database';
import { adminFixture, applicationFixture, ids, providerFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const company = (changes = {}) => providerFixture({ providerProfile: { ...providerFixture().providerProfile, organizationType: 'company', opportunityCategories: ['jobs', 'internships', 'mentorship'] }, ...changes });
const job = (changes = {}) => ({ title: 'Synthetic React opportunity', description: 'An ordinary synthetic opportunity for isolated testing.', type: 'job', requiredSkills: ['React'], location: 'Test Campus', workMode: 'remote', status: 'open', paymentInfo: 'Synthetic compensation details', applicationDeadline: '2099-01-01T12:00:00.000Z', ...changes });
const role = (id: Types.ObjectId) => id.equals(ids.admin) ? 'admin' : [ids.student, ids.outsider].some(student => student.equals(id)) ? 'student' : 'provider';
const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, id?: Types.ObjectId) => {
  const call = request(app)[method](path); return id ? call.auth(generateToken(String(id), role(id)), { type: 'bearer' }) : call;
};
const list = (query = '') => api('get', `/api/opportunities${query}`);
const publish = (changes = {}, owner = ids.provider) => api('post', '/api/opportunities', owner).send(job(changes));
const edit = (changes: object, id = ids.scholarship, owner = ids.provider) => api('put', `/api/opportunities/${id}`, owner).send(changes);
const save = (id = ids.scholarship, student = ids.student) => api('put', `/api/opportunities/${id}/saved`, student).send({});
const unsave = (id = ids.scholarship, student = ids.student) => api('delete', `/api/opportunities/${id}/saved`, student).send({});
const submit = (changes = {}, student = ids.student) => api('post', '/api/applications', student).send({ opportunityId: String(ids.scholarship), justification: 'Private synthetic justification for a human reviewer; this is isolated test data.', selfDeclaredNeed: 'medium', ...changes });
const decide = (id: string, status: string, changes = {}, owner = ids.provider) => api('patch', `/api/applications/${id}/status`, owner).send({ status, ...changes });
const history = (id: string, actor = ids.student, query = '') => api('get', `/api/applications/${id}/history${query}`, actor);
const deadlineSoon = () => new Date(Date.now() + 6 * 3600_000);
async function applied(student = ids.student) { const response = await submit({}, student); expect(response.status, JSON.stringify(response.body)).toBe(201); return response.body.data.application; }
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); await User.create([studentFixture(), studentFixture({ _id: ids.outsider, email: 'other-student@example.test' }), company(), adminFixture()]); await Opportunity.create({ ...job(), _id: ids.scholarship, providerId: ids.provider }); });
afterAll(() => database.stop());

describe('opportunity publishing, public search and logical expiration', () => {
  it('publishes through the verified provider API, edits with revision and preserves public response fields', async () => {
    const response = await publish({ providerId: String(ids.admin) }); expect(response.status).toBe(201); const row = response.body.data.opportunity;
    expect(row).toMatchObject({ revision: 0, providerId: { _id: String(ids.provider) } });
    const updated = await edit({ revision: 0, title: 'Updated synthetic title' }, new Types.ObjectId(row._id)); expect(updated.status).toBe(200); expect(updated.body.data.opportunity.revision).toBe(1);
    expect((await edit({ revision: 0, title: 'Stale synthetic title' }, new Types.ObjectId(row._id))).status).toBe(409);
    const detail = await api('get', `/api/opportunities/${row._id}`); expect(detail.status).toBe(200); expect(detail.body.data.opportunity.views).toBe(1);
  });
  it('validates publication fields, dates, malformed skill arrays and server-owned expiration', async () => {
    for (const change of [{ title: 'a' }, { title: 'x'.repeat(161) }, { description: 'short' }, { requiredSkills: [''] }, { requiredSkills: Array(41).fill('React') }, { applicationDeadline: '2099-02-30' }, { applicationDeadline: '2099-01-01T12:00:00' }, { applicationDeadline: '2000-01-01' }, { status: 'expired' }]) expect((await publish(change)).status).toBe(400);
  });
  it('restricts creation/editing by role, ownership, verification and provider service capability', async () => {
    expect((await api('post', '/api/opportunities', ids.student).send(job())).status).toBe(403);
    expect((await api('post', '/api/opportunities').send(job())).status).toBe(401);
    await User.create(company({ _id: ids.lecturer, email: 'other-provider@example.test' })); expect((await edit({ title: 'Unauthorized modification' }, ids.scholarship, ids.lecturer)).status).toBe(404);
    expect((await publish({ type: 'scholarship', amount: 100, currency: 'LKR', coverageType: 'partial', numberOfAwards: 1, renewable: false, eligibilityCriteria: ['Enrolled student'] })).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false }); expect((await publish()).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, requiresEmailVerification: true }); expect((await edit({ title: 'An email-gated edit must fail.' })).status).toBe(403);
  });
  it('publishes and edits structured eligibility through the real API before applications exist', async () => {
    const response = await publish({ eligibility: { ...defaultOpportunityEligibility(), degrees: ['ICT'], requiredSkills: ['React.js'] } }); expect(response.status, JSON.stringify(response.body)).toBe(201);
    const row = response.body.data.opportunity; expect(row.eligibility.degrees).toEqual(['ict']);
    expect((await api('get', `/api/opportunities/${row._id}/eligibility`, ids.student)).body.data.canApply).toBe(true);
    const changed = await edit({ revision: 0, eligibility: { ...defaultOpportunityEligibility(), minStudyYear: 3 } }, new Types.ObjectId(row._id)); expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    expect((await api('get', `/api/opportunities/${row._id}/eligibility`, ids.student)).body.data.canApply).toBe(false);
    expect((await submit({ opportunityId: row._id })).status).toBe(409);
  });
  it('rechecks provider services inside the transaction after authentication', async () => {
    const original = mongoose.connection.transaction.bind(mongoose.connection);
    vi.spyOn(mongoose.connection, 'transaction').mockImplementationOnce(async (work, options) => { await User.updateOne({ _id: ids.provider }, { 'providerProfile.opportunityCategories': ['mentorship'] }); return original(work, options); });
    const response = await publish(); expect(response.status).toBe(403); expect(await Opportunity.countDocuments()).toBe(1);
  });
  it('searches literal title/description, skills, locations, deadline bounds and work mode', async () => {
    await Opportunity.create({ ...job({ title: 'C++ [campus] workshop', description: 'Synthetic hands-on sensor opportunity for tests.', type: 'workshop', location: 'Southern Campus', requiredSkills: ['C++'], isFree: true }), providerId: ids.provider });
    expect((await list('?q=C%2B%2B%20%5Bcampus%5D&skill=C%2B%2B&location=Southern&workMode=remote&isFree=true&type=workshop')).body.data.total).toBe(1);
    expect((await list('?q=sensor')).body.data.total).toBe(1); expect((await list('?q=.*')).body.data.total).toBe(0);
    expect((await list(`?providerId=${ids.provider}&deadlineFrom=2098-01-01&deadlineTo=2099-12-31`)).body.data.total).toBe(2);
  });
  it('bounds stable pagination before serialization and does not leak provider private fields', async () => {
    await User.collection.updateOne({ _id: ids.provider }, { $set: { 'providerProfile.futureSensitiveField': 'PRIVATE-FUTURE-FIELD', 'providerProfile.rejectionReason': 'PRIVATE-REVIEW-REASON' } });
    await Opportunity.insertMany([1, 2, 3].map(index => ({ ...job({ title: `Synthetic listing ${index}` }), providerId: ids.provider, createdAt: new Date('2029-01-01') })));
    const first = await list('?limit=2'); const second = await list('?limit=2&page=2'); expect(first.body.data).toMatchObject({ total: 4, page: 1, limit: 2, pages: 2 });
    expect(first.body.data.opportunities.map((row: { _id: string }) => row._id).filter((id: string) => second.body.data.opportunities.some((row: { _id: string }) => row._id === id))).toEqual([]);
    expect(JSON.stringify(first.body)).not.toMatch(/PRIVATE|password|"email"|"accountStatus"|"verificationStatus"|"contactEmail"/); expect(first.body.data.opportunities[0].providerCredibility.verification).toBe('provider_verified');
  });
  it('rejects invalid filters, IDs, injection shapes and excessive limits', async () => {
    for (const query of ['page=0', 'limit=101', 'type=unknown', 'workMode=unknown', 'q[$ne]=x', 'q=x&q=y', 'providerId=bad', 'sort=unknown', 'status=draft', 'isPaid=1']) expect((await list(`?${query}`)).status).toBe(400);
    expect((await api('get', '/api/opportunities/bad')).status).toBe(400);
  });
  it('excludes inactive, revoked, email-gated and deleted providers from every discovery surface', async () => {
    for (const change of [{ accountStatus: 'suspended' }, { 'providerProfile.verificationStatus': 'NEEDS_INFO' }, { requiresEmailVerification: true }]) {
      await User.updateOne({ _id: ids.provider }, change); expect((await list()).body.data.total).toBe(0);
      expect((await api('get', `/api/opportunities/${ids.scholarship}`)).status).toBe(404); expect((await api('get', '/api/opportunities/matched', ids.student)).body.data.total).toBe(0);
      expect((await api('get', `/api/providers/${ids.provider}`)).body.data.opportunities).toEqual([]);
      await User.updateOne({ _id: ids.provider }, { accountStatus: 'active', 'providerProfile.verificationStatus': 'VERIFIED', requiresEmailVerification: false });
    }
    await User.deleteOne({ _id: ids.provider }); expect((await list()).body.data.total).toBe(0);
  });
  it('hides draft, closed and expired listings without globally mutating them on public reads', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { applicationDeadline: new Date(0) });
    expect((await list()).body.data.total).toBe(0); expect((await api('get', `/api/opportunities/${ids.scholarship}`)).status).toBe(404);
    const mine = await api('get', '/api/opportunities/mine?status=expired', ids.provider); expect(mine.body.data.opportunities[0].status).toBe('expired');
    await api('get', '/api/provider/dashboard', ids.provider); expect((await Opportunity.findById(ids.scholarship))?.status).toBe('open');
    expect((await edit({ status: 'closed' })).status).toBe(200); expect((await edit({ status: 'open' })).status).toBe(400);
    expect((await edit({ status: 'open', applicationDeadline: '2099-01-01' })).status).toBe(200);
    await Opportunity.updateOne({ _id: ids.scholarship }, { status: 'draft' }); expect((await list()).body.data.total).toBe(0);
  });
  it('returns owner application counts with bounded filtering and stable ordering', async () => {
    await applied(); const response = await api('get', '/api/opportunities/mine?type=job&limit=1', ids.provider); expect(response.body.data.opportunities[0].applicationCount).toBe(1); expect(response.body.data.total).toBe(1);
    expect((await api('get', '/api/opportunities/mine?status=unknown', ids.provider)).status).toBe(400);
  });
  it('supports actual internship, training and scholarship publication without duplicating their workflows', async () => {
    expect((await publish({ type: 'internship', duration: '12 weeks', isPaid: true, preferredAcademicBackground: 'ICT students' })).status).toBe(201);
    await User.create(providerFixture({ _id: ids.alumni, email: 'training@example.test', providerProfile: { ...providerFixture().providerProfile, organizationType: 'training_org', opportunityCategories: ['training'] } }));
    expect((await publish({ type: 'workshop', duration: 'Two days', isFree: false, fee: 100, startDate: '2099-02-01', endDate: '2099-02-02' }, ids.alumni)).status).toBe(201);
    expect((await publish({ type: 'course', duration: 'Two days', isFree: true, startDate: '2099-02-02', endDate: '2099-02-01' }, ids.alumni)).status).toBe(400);
    await User.create(providerFixture({ _id: ids.lecturer, email: 'scholarship@example.test' }));
    const response = await api('post', '/api/opportunities', ids.lecturer).send({ ...scholarshipFixture(), _id: undefined }); expect(response.status).toBe(201);
    expect((await api('get', '/api/opportunities/scholarships?limit=1')).body.data.total).toBe(1);
  });
});

describe('private saving, eligibility and globally ranked rule matching', () => {
  it('saves idempotently, preserves the original saved timestamp and unsaves idempotently', async () => {
    const first = await save(); const again = await save(); expect(first.status).toBe(200); expect(again.body.data.saved).toEqual(first.body.data.saved); expect(await SavedOpportunity.countDocuments()).toBe(1);
    const response = await api('get', '/api/opportunities/saved', ids.student); expect(response.body.data.savedOpportunities[0]).toMatchObject({ availability: 'available', opportunity: { _id: String(ids.scholarship) } });
    expect((await unsave()).status).toBe(200); expect((await unsave()).status).toBe(200); expect(await SavedOpportunity.countDocuments()).toBe(0);
  });
  it('allows only one saved record under simultaneous requests and keeps students isolated', async () => {
    const responses = await Promise.all([save(), save()]); expect(responses.map(row => row.status)).toEqual([200, 200]); expect(await SavedOpportunity.countDocuments()).toBe(1);
    expect((await api('get', '/api/opportunities/saved', ids.outsider)).body.data.total).toBe(0); await unsave(ids.scholarship, ids.outsider); expect(await SavedOpportunity.countDocuments()).toBe(1);
    expect((await api('put', `/api/opportunities/${ids.scholarship}/saved`, ids.student).send({ studentId: String(ids.outsider) })).status).toBe(400);
  });
  it('rejects unauthorized saved access, limited sessions, invalid IDs and unsupported input', async () => {
    expect((await api('get', '/api/opportunities/saved')).status).toBe(401); expect((await api('get', '/api/opportunities/saved', ids.provider)).status).toBe(403);
    expect((await request(app).get('/api/opportunities/saved').auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await save()).status).toBe(403); expect((await api('get', '/api/opportunities/saved', ids.student)).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: false }); expect((await api('put', '/api/opportunities/bad/saved', ids.student).send({})).status).toBe(400);
  });
  it('retains unavailable placeholders without leaking a withdrawn, draft or deleted listing', async () => {
    await save(); await Opportunity.updateOne({ _id: ids.scholarship }, { status: 'draft', title: 'PRIVATE DRAFT CONTENT' });
    let response = await api('get', '/api/opportunities/saved', ids.student); expect(response.body.data.savedOpportunities[0]).toMatchObject({ availability: 'unavailable', opportunity: null }); expect(JSON.stringify(response.body)).not.toContain('PRIVATE');
    await Opportunity.deleteOne({ _id: ids.scholarship }); response = await api('get', '/api/opportunities/saved', ids.student); expect(response.body.data.total).toBe(1); expect((await unsave()).status).toBe(200);
  });
  it('refuses unavailable saving and enforces the 500-entry per-student bound', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { applicationDeadline: new Date(0) }); expect((await save()).status).toBe(404);
    await Opportunity.updateOne({ _id: ids.scholarship }, { applicationDeadline: new Date('2099-01-01') });
    await SavedOpportunity.insertMany(Array.from({ length: 500 }, () => ({ studentId: ids.student, opportunityId: new Types.ObjectId() })));
    expect((await save()).status).toBe(409); expect(await SavedOpportunity.countDocuments()).toBe(500);
  });
  it('paginates saved history including unavailable rows with no cross-user count disclosure', async () => {
    await SavedOpportunity.insertMany(Array.from({ length: 3 }, () => ({ studentId: ids.student, opportunityId: new Types.ObjectId() })));
    const response = await api('get', '/api/opportunities/saved?limit=2&page=2', ids.student); expect(response.body.data).toMatchObject({ total: 3, pages: 2 }); expect(response.body.data.savedOpportunities).toHaveLength(1);
    expect((await api('get', '/api/opportunities/saved?limit=101', ids.student)).status).toBe(400);
  });
  it('explains mandatory eligibility independently from advisory preferred skills and prior application', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { requiredSkills: ['Java'], eligibility: { ...defaultOpportunityEligibility(), requiredSkills: ['TypeScript'], degrees: ['ict'] } });
    const response = await api('get', `/api/opportunities/${ids.scholarship}/eligibility`, ids.student); expect(response.body.data).toMatchObject({ eligible: true, canApply: true, policySource: 'listing', matching: { missingSkills: ['Java'], method: 'rules' } });
    await applied(); expect((await api('get', `/api/opportunities/${ids.scholarship}/eligibility`, ids.student)).body.data).toMatchObject({ alreadyApplied: true, canApply: false });
  });
  it('enforces explicitly published eligibility at submission and does not create fake decisions', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { eligibility: { ...defaultOpportunityEligibility(), degrees: ['et'] } });
    const response = await api('get', `/api/opportunities/${ids.scholarship}/eligibility`, ids.student); expect(response.body.data.canApply).toBe(false); expect(response.body.data.reasons).toContain('Degree programme must meet the explicitly published requirements.');
    expect((await submit()).status).toBe(409); expect(await Application.countDocuments()).toBe(0); expect(await ApplicationEvent.countDocuments()).toBe(0);
  });
  it('freezes mandatory eligibility and opportunity type after submission', async () => {
    await applied(); expect((await edit({ eligibility: { ...defaultOpportunityEligibility(), minStudyYear: 4 } })).status).toBe(409);
    expect((await edit({ type: 'internship', duration: 'Three months', isPaid: true, preferredAcademicBackground: 'ICT students' })).status).toBe(409);
    expect((await edit({ description: 'An updated public description that keeps the original mandatory requirements.' })).status).toBe(200);
  });
  it('uses existing scholarship policy for explanations and requires no generic scholarship policy duplicate', async () => {
    await User.create(providerFixture({ _id: ids.lecturer, email: 'scholarship@example.test' })); await Opportunity.deleteMany({}); await Opportunity.create(scholarshipFixture({ providerId: ids.lecturer }));
    const response = await api('get', `/api/opportunities/${ids.scholarship}/eligibility`, ids.student); expect(response.body.data).toMatchObject({ policySource: 'scholarship_policy', eligible: true, canApply: true });
    expect((await edit({ eligibility: defaultOpportunityEligibility() }, ids.scholarship, ids.lecturer)).status).toBe(400);
  });
  it('ranks all candidates before pagination, with deterministic ties and the original score fields', async () => {
    await Opportunity.updateOne({ _id: ids.scholarship }, { createdAt: new Date('2020-01-01'), requiredSkills: ['React.js', 'TypeScript'] });
    await Opportunity.create({ ...job({ requiredSkills: ['Python'], title: 'Newer lower fit listing' }), providerId: ids.provider });
    const first = await api('get', '/api/opportunities/matched?limit=1', ids.student); const second = await api('get', '/api/opportunities/matched?limit=1&page=2', ids.student);
    expect(first.body.data.opportunities[0]._id).toBe(String(ids.scholarship)); expect(first.body.data.opportunities[0].matchPercentage).toBeGreaterThan(second.body.data.opportunities[0].matchPercentage);
    expect(first.body.data.opportunities[0]).toMatchObject({ matchingMethod: 'rules', matchingVersion: 2, matchedSkills: ['React.js', 'TypeScript'], breakdown: { skillWeight: 60, careerWeight: 25, locationWeight: 15 } }); expect(first.body.data.total).toBe(2);
  });
  it('removes Java/JavaScript, blank and duplicate skill score inflation while explaining missing skills', async () => {
    await User.updateOne({ _id: ids.student }, { 'studentProfile.skills': ['JavaScript'] }); await Opportunity.updateOne({ _id: ids.scholarship }, { requiredSkills: ['Java', 'Java', ''] });
    const response = await api('get', '/api/opportunities/matched', ids.student); expect(response.body.data.opportunities[0]).toMatchObject({ matchedSkills: [], missingSkills: ['Java'], skillScore: 0 });
  });
});

describe('transactional applications, real status history and retained sources', () => {
  it('records submission and status decisions with expected revisions, private reasons and pagination', async () => {
    const row = await applied(); expect(row.statusHistoryVersion).toBe(1);
    expect((await decide(row._id, 'reviewed', { revision: 0, reason: 'Private review explanation for this applicant.' })).status).toBe(200);
    expect((await decide(row._id, 'accepted', { revision: 1, reason: 'Accepted after human review of the application.' })).status).toBe(200);
    const response = await history(row._id, ids.student, '?limit=2'); expect(response.body.data).toMatchObject({ historyComplete: true, total: 3, revision: 2, status: 'accepted' }); expect(response.body.data.events).toHaveLength(2);
    expect(response.body.data.events[0].reason).toContain('human review'); expect((await history(row._id, ids.provider)).status).toBe(200);
  });
  it('rejects student/outsider/admin decision and history access without revealing private text', async () => {
    const row = await applied(); expect((await decide(row._id, 'accepted', {}, ids.student)).status).toBe(403); expect((await history(row._id, ids.outsider)).status).toBe(404); expect((await history(row._id, ids.admin)).status).toBe(403);
    await User.create(company({ _id: ids.lecturer, email: 'outsider-provider@example.test' })); expect((await decide(row._id, 'accepted', {}, ids.lecturer)).status).toBe(404); expect((await history(row._id, ids.lecturer)).status).toBe(404);
  });
  it('prevents duplicate submission including concurrent requests and creates exactly one initial event', async () => {
    const responses = await Promise.all([submit(), submit()]); expect(responses.map(row => row.status).sort()).toEqual([201, 409]); expect(await Application.countDocuments()).toBe(1); expect(await ApplicationEvent.countDocuments()).toBe(1); expect(await NotificationOutbox.countDocuments()).toBe(1);
  });
  it('checks source availability and provider verification again at the submission transaction', async () => {
    const original = mongoose.connection.transaction.bind(mongoose.connection);
    vi.spyOn(mongoose.connection, 'transaction').mockImplementationOnce(async (work, options) => { await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false }); return original(work, options); });
    expect((await submit()).status).toBe(404); expect(await Application.countDocuments()).toBe(0);
  });
  it('rejects expired, withdrawn, overlong and unsupported submissions with no history writes', async () => {
    expect((await submit({ message: 'x'.repeat(1001) })).status).toBe(400); expect((await submit({ providerId: String(ids.admin) })).status).toBe(400);
    await Opportunity.updateOne({ _id: ids.scholarship }, { opportunityWithdrawnByAdmin: true }); expect((await submit()).status).toBe(404);
    await Opportunity.updateOne({ _id: ids.scholarship }, { opportunityWithdrawnByAdmin: false, applicationDeadline: new Date(0) }); expect((await submit()).status).toBe(404); expect(await ApplicationEvent.countDocuments()).toBe(0);
  });
  it('serializes competing human decisions and rejects stale expected revisions', async () => {
    const row = await applied(); const results = await Promise.all([decide(row._id, 'accepted', { revision: 0 }), decide(row._id, 'rejected', { revision: 0 })]); expect(results.map(row => row.status).sort()).toEqual([200, 409]);
    expect(await ApplicationEvent.countDocuments()).toBe(2); expect(await NotificationOutbox.countDocuments()).toBe(2);
  });
  it('does not duplicate history/notifications on repeats and enforces reasoned reopening', async () => {
    const row = await applied(); await decide(row._id, 'rejected'); expect((await decide(row._id, 'rejected')).status).toBe(200); expect(await ApplicationEvent.countDocuments()).toBe(2);
    expect((await decide(row._id, 'accepted')).status).toBe(409); expect((await decide(row._id, 'reviewed')).status).toBe(400);
    expect((await decide(row._id, 'reviewed', { reason: 'New information merits another human review.' })).status).toBe(200); expect((await decide(row._id, 'applied')).status).toBe(409);
  });
  it('rechecks student eligibility before acceptance and prevents acceptance of moderated sources', async () => {
    const row = await applied(); await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' }); expect((await decide(row._id, 'accepted')).status).toBe(409);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'active' }); await Opportunity.updateOne({ _id: ids.scholarship }, { opportunityWithdrawnByAdmin: true }); expect((await decide(row._id, 'accepted')).status).toBe(409); expect((await decide(row._id, 'rejected')).status).toBe(200);
  });
  it('retains ordinary source/history on deletion after applications and prevents admin-withdrawn republishing', async () => {
    const row = await applied(); const response = await api('delete', `/api/opportunities/${ids.scholarship}`, ids.provider); expect(response.status).toBe(200); expect(response.body.data.retained).toBe(true);
    expect((await history(row._id, ids.provider)).status).toBe(200); expect((await list()).body.data.total).toBe(0);
    await removeScholarshipAwareListing(String(ids.scholarship), ids.admin, 'admin'); expect((await edit({ status: 'open' })).status).toBe(403); expect((await Opportunity.findById(ids.scholarship))?.opportunityWithdrawnByAdmin).toBe(true);
  });
  it('does not invent historical events for legacy applications', async () => {
    const row = await Application.create(applicationFixture()); const response = await history(String(row._id)); expect(response.body.data).toMatchObject({ historyComplete: false, events: [], status: 'applied' }); expect(response.body.data.legacyNotice).toContain('not reconstructed');
    await decide(String(row._id), 'reviewed'); expect((await history(String(row._id))).body.data.historyComplete).toBe(false); expect(await ApplicationEvent.countDocuments()).toBe(1);
  });
  it('reuses private scholarship decision history without exposing evidence or policy records', async () => {
    await User.create(providerFixture({ _id: ids.lecturer, email: 'scholarships@example.test' })); await Opportunity.deleteMany({}); await Opportunity.create(scholarshipFixture({ providerId: ids.lecturer }));
    const row = await applied(); expect((await decide(row._id, 'rejected', { reason: 'Human scholarship rejection explanation.' }, ids.lecturer)).status).toBe(200);
    const response = await history(row._id); expect(response.body.data.historyComplete).toBe(true); expect(response.body.data.total).toBe(2); expect(JSON.stringify(response.body)).not.toMatch(/documentId|policySnapshot|priorityOverrideReason/);
  });
  it('rolls back submission/history if notification persistence fails and sanitizes infrastructure errors', async () => {
    vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('PRIVATE-DATABASE-DRIVER-FAILURE'));
    const response = await submit(); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('PRIVATE-DATABASE'); expect(await Application.countDocuments()).toBe(0); expect(await ApplicationEvent.countDocuments()).toBe(0);
  });
  it('rolls back a status decision and its audit record if delivery event enqueue fails', async () => {
    const row = await applied(); vi.spyOn(NotificationOutbox, 'updateOne').mockRejectedValueOnce(new Error('Synthetic queue failure'));
    expect((await decide(row._id, 'accepted')).status).toBe(503); expect((await Application.findById(row._id))?.status).toBe('applied'); expect(await ApplicationEvent.countDocuments()).toBe(1);
  });
});

describe('saved opportunity deadline notices through the existing durable worker', () => {
  beforeEach(async () => { await Opportunity.updateOne({ _id: ids.scholarship }, { applicationDeadline: deadlineSoon() }); await save(); });
  it('queues once per saved entry/deadline and delivers a canonical private notice to the owner', async () => {
    await enqueueNotificationReminders(); await enqueueNotificationReminders(); expect(await NotificationOutbox.countDocuments({ sourceType: 'opportunity' })).toBe(1);
    expect((await runNotificationBatch(100)).delivered).toBe(1); const row = await Notification.findOne(); expect(row).toMatchObject({ kind: 'application', action: 'deadline', href: '/opportunities', title: 'Saved opportunity deadline approaching' }); expect(String(row?.ownerId)).toBe(String(ids.student)); expect(JSON.stringify(row)).not.toContain('Synthetic React');
  });
  it('suppresses queued notices after unsaving and never resurrects the old saved entry', async () => {
    await enqueueNotificationReminders(); await unsave(); expect((await runNotificationBatch(100)).suppressed).toBe(1); expect(await Notification.countDocuments()).toBe(0);
    await save(); await enqueueNotificationReminders(); expect((await runNotificationBatch(100)).delivered).toBe(1); expect(await NotificationOutbox.countDocuments({ sourceType: 'opportunity' })).toBe(2);
  });
  it('suppresses old-deadline notices after an extension and schedules a fresh exact-deadline notice', async () => {
    await enqueueNotificationReminders(); const changed = new Date(Date.now() + 12 * 3600_000).toISOString(); expect((await edit({ applicationDeadline: changed })).status).toBe(200);
    await enqueueNotificationReminders(); await runNotificationBatch(100); expect(await NotificationOutbox.countDocuments({ sourceType: 'opportunity', status: 'suppressed' })).toBe(1); expect(await Notification.countDocuments()).toBe(1);
  });
  it('suppresses notices after application submission, source closure or provider verification withdrawal', async () => {
    await enqueueNotificationReminders(); await applied(); await NotificationOutbox.deleteMany({ sourceType: { $ne: 'opportunity' } }); expect((await runNotificationBatch(100)).suppressed).toBe(1);
    await Application.deleteMany({}); await NotificationOutbox.deleteMany({}); await enqueueNotificationReminders(); await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': false }); expect((await runNotificationBatch(100)).suppressed).toBe(1); expect(await Notification.countDocuments()).toBe(0);
  });
  it('advances a bounded saved-entry cursor over nondue rows without starving later deadlines', async () => {
    await SavedOpportunity.insertMany([1, 2].map(index => ({ _id: new Types.ObjectId(`00000000000000000000010${index}`), studentId: ids.student, opportunityId: new Types.ObjectId() })));
    for (let scan = 0; scan < 5; scan++) await enqueueNotificationReminders(1);
    expect(await NotificationOutbox.countDocuments({ sourceType: 'opportunity' })).toBe(1);
  });
});
