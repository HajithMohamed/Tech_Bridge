import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import Opportunity from '../../src/models/Opportunity';
import AuthRateLimit from '../../src/models/AuthRateLimit';
import { authBucket } from '../../src/services/authThrottle';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const company = () => providerFixture({ providerProfile: { ...providerFixture().providerProfile, organizationType: 'company', opportunityCategories: ['jobs', 'internships'] } });
const job = (changes = {}) => ({ title: 'Synthetic general vacancy', description: 'An internal synthetic opportunity for isolated recommendation tests.', type: 'job', requiredSkills: [], location: 'Test Campus', workMode: 'remote', status: 'open', providerId: ids.provider, paymentInfo: 'Synthetic pay', applicationDeadline: new Date('2099-01-01'), createdAt, ...changes });
const role = (id: Types.ObjectId) => id.equals(ids.admin) ? 'admin' : id.equals(ids.provider) ? 'provider' : 'student';
const api = (method: 'get' | 'patch' | 'post' | 'put' | 'delete', path: string, id?: Types.ObjectId) => {
  const call = request(app)[method](path); return id ? call.auth(generateToken(String(id), role(id)), { type: 'bearer' }) : call;
};
const feed = (query = '', id = ids.student) => api('get', `/api/opportunities/recommendations${query}`, id);
const preferences = (id = ids.student) => api('get', '/api/opportunities/recommendation-preferences', id);
const patch = (changes: object, id = ids.student) => api('patch', '/api/opportunities/recommendation-preferences', id).send({ revision: 0, ...changes });
const createJob = (changes = {}) => Opportunity.create(job(changes));
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); await User.create([studentFixture(), studentFixture({ _id: ids.outsider, email: 'peer@example.test' }), company(), adminFixture()]); });
afterAll(() => database.stop());

describe('private self-owned recommendation preferences', () => {
  it('reads defaults for existing records and updates interests, extracurricular activities and preferences', async () => {
    expect((await preferences()).body.data).toMatchObject({ revision: 0, personalizationEnabled: true, careerInterests: [], extracurricularActivities: [] });
    const response = await patch({ specialization: 'Media production', careerInterests: ['Creative work'], extracurricularActivities: ['content writing', 'video editing', 'photography'], preferredOpportunityTypes: ['freelance'], preferredWorkArrangements: ['remote'], preferredEmploymentArrangements: ['part-time'], preferredLocations: ['Galle'], careerStagePreference: 'graduate' });
    expect(response.status, JSON.stringify(response.body)).toBe(200); expect(response.body.data).toMatchObject({ revision: 1, specialization: 'Media production', extracurricularActivities: ['content writing', 'video editing', 'photography'], preferredEmploymentArrangements: ['part-time'] });
    expect((await preferences()).body.data).toEqual(response.body.data);
  });
  it('allows explicit clearing and preserves creator visibility, institution and academic fields', async () => {
    await User.updateOne({ _id: ids.student }, { 'studentProfile.creatorProfile.isDiscoverable': true });
    expect((await patch({ extracurricularActivities: ['photography'] })).status).toBe(200);
    const cleared = await patch({ revision: 1, extracurricularActivities: [], careerInterests: [], skills: [] }); expect(cleared.status).toBe(200); expect(cleared.body.data.extracurricularActivities).toEqual([]);
    const student = await User.findById(ids.student); expect(student!.studentProfile).toMatchObject({ institution: 'Test University', degree: 'ICT', creatorProfile: { isDiscoverable: true } });
  });
  it('rejects stale writes and atomically accepts only one of two concurrent edits', async () => {
    const responses = await Promise.all([patch({ careerInterests: ['programming'] }), patch({ extracurricularActivities: ['photography'] })]);
    expect(responses.map(row => row.status).sort()).toEqual([200, 409]); expect((await preferences()).body.data.revision).toBe(1);
  });
  it.each([{ studentId: String(ids.outsider) }, { role: 'admin' }, { weights: { interests: 100 } }, { gender: 'private' }, { extracurricularActivities: ['<script>alert(1)</script>'] }, { careerInterests: Array(21).fill('x') }, { personalizationEnabled: 'false' }, { preferredLocations: { $ne: '' } }, { 'recommendationPreferences.revision': 100 }, { studyYear: 9 }])('rejects malformed or unauthorized preference fields %j', async changes => {
    const response = await patch(changes); expect(response.status).toBe(400); expect((await preferences()).body.data.revision).toBe(0);
  });
  it('requires authentication, student role, active status and full sessions', async () => {
    expect((await api('patch', '/api/opportunities/recommendation-preferences').send({ revision: 0, personalizationEnabled: false })).status).toBe(401);
    for (const id of [ids.provider, ids.admin]) expect((await patch({ personalizationEnabled: false }, id)).status).toBe(403);
    expect((await request(app).get('/api/opportunities/recommendations').auth(generateVerificationToken(String(ids.provider)), { type: 'bearer' })).status).toBe(401);
    await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' }); expect((await preferences()).status).toBe(403);
  });
  it('denies email-gated accounts and rechecks revoked sessions after authentication', async () => {
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); expect((await feed()).status).toBe(403);
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: false });
    const transaction = mongoose.connection.transaction.bind(mongoose.connection);
    vi.spyOn(mongoose.connection, 'transaction').mockImplementationOnce(async (work, options) => { await User.updateOne({ _id: ids.student }, { tokenVersion: 1 }); return transaction(work, options); });
    expect((await feed()).status).toBe(401);
  });
  it('does not expose the new private fields through ordinary model reads, peer preferences or public provider views', async () => {
    await patch({ extracurricularActivities: ['PRIVATE-ACTIVITY'], careerInterests: ['PRIVATE-INTEREST'], specialization: 'PRIVATE-SPECIALIZATION' });
    expect(JSON.stringify((await User.findById(ids.student))!.toObject())).not.toMatch(/PRIVATE-/);
    expect(JSON.stringify((await preferences(ids.outsider)).body)).not.toMatch(/PRIVATE-/);
    const response = await api('get', `/api/providers/${ids.provider}`); expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE-/);
    expect((await preferences()).headers['cache-control']).toBe('no-store');
  });
  it('preserves new preferences when the legacy academic profile endpoint saves existing fields', async () => {
    await patch({ extracurricularActivities: ['photography'], personalizationEnabled: false });
    const response = await api('put', '/api/auth/student-profile', ids.student).send({ institution: 'Updated Campus', degree: 'ICT', studyYear: 3, skills: ['Java'] });
    expect(response.status).toBe(200); expect((await preferences()).body.data).toMatchObject({ revision: 2, extracurricularActivities: ['photography'], personalizationEnabled: false, studyYear: 3 });
    expect((await feed('?revision=1')).status).toBe(409);
  });
  it('does not bypass preference validation through registration', async () => {
    const response = await api('post', '/api/auth/register').send({ fullName: 'Synthetic Signup', email: 'signup@example.test', password: 'Synthetic-Test-Password-42!', confirmPassword: 'Synthetic-Test-Password-42!', role: 'student', studentProfile: { institution: 'Campus', degree: 'ICT', studyYear: 2, skills: ['Java'], careerInterests: ['PRIVATE-IGNORED'], extracurricularActivities: ['PRIVATE-IGNORED'], recommendationPreferences: { revision: 99999, personalizationEnabled: false } } });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const stored = await User.findOne({ email: 'signup@example.test' }).select('+studentProfile.careerInterests +studentProfile.extracurricularActivities +studentProfile.recommendationPreferences');
    expect(stored!.studentProfile!.recommendationPreferences).toBeUndefined(); expect(stored!.studentProfile!.careerInterests).toBeUndefined();
  });
});

describe('ranked discovery, extracurricular interests and manual browsing', () => {
  it.each(['ICT', 'ET', 'BST'])('ranks the %s student department first without hiding other departments', async degree => {
    await patch({ degree, skills: [], careerGoal: '', careerInterests: [], extracurricularActivities: [] });
    const rows = await Opportunity.create(['ICT', 'ET', 'BST'].map(department => job({ title: `Synthetic ${department} vacancy`, recommendationMetadata: { departments: [department] } })));
    const response = await feed(); expect(response.status, JSON.stringify(response.body)).toBe(200); expect(response.body.data.total).toBe(3); expect(response.body.data.opportunities[0]._id).toBe(String(rows.find(row => row.recommendationMetadata!.departments![0] === degree)!._id));
    expect(response.body.data.opportunities[0].recommendation.score).toBeNull();
  });
  it.each(['content writing', 'video editing', 'photography'])('raises %s opportunities above academic defaults and refreshes after edits', async activity => {
    const academic = await createJob({ title: 'Synthetic programming job', requiredSkills: [], recommendationMetadata: { departments: ['ICT'] } });
    const creative = await createJob({ title: `Synthetic ${activity} role`, recommendationMetadata: { activities: [activity], departments: ['BST'] } });
    await patch({ skills: [], careerGoal: '', extracurricularActivities: [activity] });
    const response = await feed(); expect(response.status, JSON.stringify(response.body)).toBe(200); expect(response.body.data.opportunities[0]._id).toBe(String(creative._id)); expect(response.body.data.opportunities[0].recommendation.explanations.join(' ')).toContain(activity);
    await patch({ revision: 1, extracurricularActivities: [], careerInterests: ['programming'] }); expect((await feed()).body.data.opportunities[0]._id).toBe(String(academic._id));
  });
  it.each([['ICT', 'robotics', 'ET'], ['ET', 'programming', 'ICT'], ['BST', 'data science', 'ICT']])('honors explicit %s interests in %s without restricting discovery', async (degree, interest, other) => {
    await patch({ degree, skills: [], careerInterests: [interest] });
    await createJob({ title: 'Synthetic department default', recommendationMetadata: { departments: [degree] } });
    const target = await createJob({ title: 'Synthetic interest target', recommendationMetadata: { departments: [other], interests: [interest] } });
    const response = await feed(); expect(response.body.data.total).toBe(2); expect(response.body.data.opportunities[0]._id).toBe(String(target._id));
  });
  it('filters multiple departments, interests, activities, sources and ordinary search', async () => {
    const target = await createJob({ title: 'Campus media vacancy', recommendationMetadata: { departments: ['ICT', 'ET'], activities: ['video editing'] } }); await createJob();
    for (const query of ['?view=ICT', '?department=ET', '?view=interdisciplinary', '?interest=video%20editing', '?activity=video%20editor&q=media&source=techbridge']) {
      const response = await feed(query); expect(response.status, JSON.stringify(response.body)).toBe(200); expect(response.body.data.total).toBe(1); expect(response.body.data.opportunities[0]._id).toBe(String(target._id));
    }
  });
  it('keeps pagination stable at tied scores, deduplicates identities and excludes new records after the anchor', async () => {
    await Opportunity.create([0, 1, 2, 3].map(index => job({ title: `Synthetic stable vacancy ${index}` })));
    const first = await feed('?limit=2'); expect(first.status).toBe(200);
    await createJob({ createdAt: new Date(new Date(first.body.data.asOf).getTime() + 1) });
    const second = await feed(`?limit=2&page=2&asOf=${encodeURIComponent(first.body.data.asOf)}&revision=${first.body.data.revision}`);
    const ids = [...first.body.data.opportunities, ...second.body.data.opportunities].map(row => row._id);
    expect(second.body.data.total).toBe(4); expect(new Set(ids).size).toBe(4); expect(ids).toEqual([...ids].sort().reverse());
    await patch({ extracurricularActivities: ['photography'] }); expect((await feed(`?revision=${first.body.data.revision}`)).status).toBe(409);
  });
  it('supports explicit newest/deadline sorting and an unpersonalized All view', async () => {
    await patch({ extracurricularActivities: ['photography'] });
    const old = await createJob({ title: 'Synthetic photography role', applicationDeadline: new Date('2099-01-01') });
    const newest = await createJob({ createdAt: new Date('2026-02-01'), applicationDeadline: new Date('2099-02-01') });
    expect((await feed('?sort=newest')).body.data.opportunities[0]._id).toBe(String(newest._id));
    expect((await feed('?sort=deadline')).body.data.opportunities[0]._id).toBe(String(old._id));
    const all = await feed('?view=all'); expect(all.body.data.personalized).toBe(false); expect(all.body.data.sort).toBe('newest'); expect(all.body.data.opportunities.every((row: { recommendation: unknown }) => row.recommendation === null)).toBe(true);
  });
  it('disables personalized ordering on both the new feed and existing matched endpoint', async () => {
    await createJob({ title: 'Synthetic photography role' }); await createJob({ createdAt: new Date('2026-02-01') });
    await patch({ extracurricularActivities: ['photography'], personalizationEnabled: false });
    const response = await feed(); expect(response.body.data.personalized).toBe(false); expect(response.body.data.opportunities.every((row: { recommendation: unknown }) => row.recommendation === null)).toBe(true);
    const legacy = await api('get', '/api/opportunities/matched', ids.student); expect(legacy.status).toBe(200); expect(legacy.body.data.personalized).toBe(false); expect(legacy.body.data.opportunities[0]._id).toBe(response.body.data.opportunities[0]._id); expect(JSON.stringify(legacy.body)).not.toContain('matchPercentage');
  });
  it('reuses owned idempotent saved opportunities and excludes unavailable saves from the open feed', async () => {
    const row = await createJob(); const save = () => api('put', `/api/opportunities/${row._id}/saved`, ids.student).send({});
    expect((await save()).status).toBe(200); expect((await save()).status).toBe(200);
    const response = await feed('?view=saved'); expect(response.body.data.total).toBe(1); expect(response.body.data.opportunities[0].saved).toBe(true); expect((await feed('?view=saved', ids.outsider)).body.data.total).toBe(0);
    await Opportunity.updateOne({ _id: row._id }, { status: 'closed' }); expect((await feed('?view=saved')).body.data.total).toBe(0);
    const legacy = await api('get', '/api/opportunities/saved', ids.student); expect(legacy.body.data.savedOpportunities[0].availability).toBe('unavailable');
    expect((await api('delete', `/api/opportunities/${row._id}/saved`, ids.student).send({})).status).toBe(200);
  });
  it('allows cold-start browsing with no student profile and suggests completion without false percentages', async () => {
    await User.updateOne({ _id: ids.student }, { $unset: { studentProfile: '' } });
    await createJob(); const internship = await createJob({ type: 'internship', title: 'Synthetic internship', recommendationMetadata: { departments: ['ICT'] } });
    const response = await feed(); expect(response.status, JSON.stringify(response.body)).toBe(200); expect(response.body.data.profileCompletion.suggested).toBe(true); expect(response.body.data.total).toBe(2); expect(response.body.data.opportunities[0]._id).toBe(String(internship._id)); expect(response.body.data.opportunities[0].recommendation.score).toBeNull();
    expect((await patch({ extracurricularActivities: ['photography'] })).status).toBe(200);
  });
  it('excludes expired, draft, closed, withdrawn and unverified-provider records without modifying them', async () => {
    const visible = await createJob();
    await Opportunity.create([{ status: 'draft' }, { status: 'closed' }, { applicationDeadline: new Date(0) }, { opportunityWithdrawnByAdmin: true }, { scholarshipWithdrawnByAdmin: true }].map(change => job(change)));
    const response = await feed(); expect(response.body.data.total).toBe(1); expect(response.body.data.opportunities[0]._id).toBe(String(visible._id));
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'suspended' }); expect((await feed()).body.data.total).toBe(0); expect(await Opportunity.countDocuments()).toBe(6);
  });
  it('returns only whitelisted opportunity/provider fields and no private profile or server ordering score', async () => {
    await patch({ careerInterests: ['PRIVATE-PREFERENCE'] }); const row = await createJob();
    await Opportunity.collection.updateOne({ _id: row._id }, { $set: { futurePrivateField: 'PRIVATE-OPPORTUNITY', 'recommendationMetadata.futurePrivateField': 'PRIVATE-NESTED' } });
    await User.collection.updateOne({ _id: ids.provider }, { $set: { 'providerProfile.futureSecret': 'PRIVATE-PROVIDER' } });
    const response = await feed(); const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/PRIVATE-|tokenVersion|orderingScore|studentSkills|password|contactEmail/); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.opportunities[0].source).toMatchObject({ kind: 'techbridge', name: 'TechBridge' });
    expect(response.body.data.opportunities[0].eligibility.status).toBe('not_evaluated');
  });
  it.each(['source=unknown', 'department=unknown', 'view=unknown', 'sort=unknown', 'page=0', 'page=101', 'limit=51', 'interest[$ne]=x', 'activity=x&activity=y', 'asOf=2099-01-01', 'asOf=2000-01-01', 'revision=-1', 'studentId=peer'])('rejects invalid or excessive feed query %s', async query => expect((await feed(`?${query}`)).status).toBe(400));
  it('does not expose database exceptions or produce partial recommendation pages', async () => {
    vi.spyOn(Opportunity, 'aggregate').mockImplementationOnce(() => { throw new Error('PRIVATE-DATABASE-ERROR'); });
    const response = await feed(); expect(response.status).toBe(503); expect(response.body.data).toBeUndefined(); expect(JSON.stringify(response.body)).not.toContain('PRIVATE-');
  });
  it('enforces a shared per-student feed limit and returns a retry interval without blocking peers', async () => {
    // Cover a minute-boundary crossing without sleeping or freezing DB clocks.
    const now = Date.now();
    const buckets = [now, now + 60_000].map(time => authBucket('recommendations:student', String(ids.student), 60_000, time));
    await AuthRateLimit.create(buckets.map(bucket => ({ _id: bucket.key, attempts: 60, expiresAt: bucket.expiresAt })));
    const response = await feed(); expect(response.status).toBe(429); expect(Number(response.headers['retry-after'])).toBeGreaterThan(0); expect((await feed('', ids.outsider)).status).toBe(200);
  });
  it('fails closed when shared abuse protection is unavailable', async () => {
    vi.spyOn(AuthRateLimit, 'findOneAndUpdate').mockRejectedValueOnce(new Error('PRIVATE-LIMITER-ERROR'));
    const response = await feed(); expect(response.status).toBe(503); expect(response.body.data).toBeUndefined(); expect(JSON.stringify(response.body)).not.toContain('PRIVATE-');
  });
});

describe('provider-owned recommendation metadata', () => {
  it('publishes and edits optional metadata through existing guarded APIs', async () => {
    const response = await api('post', '/api/opportunities', ids.provider).send(job({ recommendationMetadata: { activities: ['content writing'], departments: ['ICT', 'ET'], careerStage: 'entry', employmentArrangement: 'part-time' } }));
    expect(response.status, JSON.stringify(response.body)).toBe(201); const row = response.body.data.opportunity;
    const changed = await api('put', `/api/opportunities/${row._id}`, ids.provider).send({ revision: 0, recommendationMetadata: { activities: ['photography'] } });
    expect(changed.status, JSON.stringify(changed.body)).toBe(200); expect(changed.body.data.opportunity.recommendationMetadata.activities).toEqual(['photography']);
    expect((await api('put', `/api/opportunities/${row._id}`, ids.student).send({ recommendationMetadata: { activities: [] } })).status).toBe(403);
  });
  it('rejects invalid metadata without inserting a listing', async () => {
    const response = await api('post', '/api/opportunities', ids.provider).send(job({ recommendationMetadata: { activities: ['<script>'], sensitiveTrait: 'private' } }));
    expect(response.status).toBe(400); expect(await Opportunity.countDocuments()).toBe(0);
  });
});
