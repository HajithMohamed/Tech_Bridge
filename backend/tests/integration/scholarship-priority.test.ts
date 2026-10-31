import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import Application from '../../src/models/Application';
import Opportunity from '../../src/models/Opportunity';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import Report from '../../src/models/Report';
import { ScholarshipAppeal, ScholarshipEvent, ScholarshipEvidence, ScholarshipPolicy, ScholarshipReview } from '../../src/models/Scholarship';
import { defaultScholarshipPolicy } from '../../src/services/scholarshipPolicy';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, applicationFixture, ids, providerFixture, scholarshipFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const student = generateToken(String(ids.student), 'student'), outsider = generateToken(String(ids.outsider), 'student'), provider = generateToken(String(ids.provider), 'provider'), otherProvider = generateToken(String(ids.lecturer), 'provider'), admin = generateToken(String(ids.admin), 'admin');
const reason = 'Independent human review of the scholarship application.';
const policyBody = (patch: object = {}, revision = 0) => ({ ...defaultScholarshipPolicy(), ...patch, reason: 'Published scholarship policy reviewed before applications.', revision });
const configure = (values: object = policyBody(), id = String(ids.scholarship)) => request(app).put(`/api/scholarships/${id}/policy`).auth(provider, { type: 'bearer' }).send(values);
const submit = async (need = 'high', actor = student, opportunityId = String(ids.scholarship)) => {
  // Configure the strict programme as its provider; student request fields cannot enable/disable policy.
  const existing = await ScholarshipPolicy.findOne({ opportunityId });
  if (!existing || existing.revision === 0) expect((await configure(policyBody(), opportunityId)).status).toBe(200);
  return request(app).post('/api/applications').auth(actor, { type: 'bearer' }).send({ opportunityId, justification: 'Synthetic scholarship application justification for independent human review.', selfDeclaredNeed: need });
};
async function apply(need = 'high', actor = student, opportunityId = String(ids.scholarship)) { const response = await submit(need, actor, opportunityId); expect(response.status).toBe(201); return response.body.data.application._id as string; }
const decide = (id: string, status: string, extra: object = {}) => request(app).patch(`/api/applications/${id}/status`).auth(provider, { type: 'bearer' }).send({ status, reason, ...extra });
const assessment = (id: string, actor = student) => request(app).get(`/api/applications/${id}/scholarship`).auth(actor, { type: 'bearer' });
const pdf = (marker = 'synthetic') => ({ fileName: `${marker}.pdf`, content: Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% ${marker}\n%%EOF\n`).toString('base64') });
const upload = (id: string, document: object = pdf(), actor = student) => request(app).post(`/api/applications/${id}/scholarship/evidence`).auth(actor, { type: 'bearer' }).send(document);
const appeal = (id: string, revision = 1, actor = student) => request(app).post(`/api/applications/${id}/scholarship/appeals`).auth(actor, { type: 'bearer' }).send({ revision, statement: 'Please independently review these synthetic circumstances and the recorded scholarship decision.' });
beforeAll(() => database.start()); beforeEach(async () => {
  await database.clear(); await User.create([studentFixture(), studentFixture({ _id: ids.outsider, email: 'outsider@example.test' }), providerFixture(), providerFixture({ _id: ids.lecturer, email: 'other-provider@example.test' }), adminFixture()]); await Opportunity.create(scholarshipFixture());
}); afterAll(() => database.stop());

describe('published policy and advisory priority snapshots', () => {
  it('preserves the existing default-client status contract and explicitly labels its missing reason', async () => {
    const created = await request(app).post('/api/applications').auth(student, { type: 'bearer' }).send({ opportunityId: String(ids.scholarship), justification: 'Synthetic application through the existing unversioned client contract.', selfDeclaredNeed: 'high', scholarshipWorkflowVersion: 1, scholarshipVersion: 1 }); expect(created.status).toBe(201); const id = created.body.data.application._id;
    expect((await request(app).patch(`/api/applications/${id}/status`).auth(provider, { type: 'bearer' }).send({ status: 'accepted' })).status).toBe(200); expect((await assessment(id)).body.data.strictDecisions).toBe(false); expect((await assessment(id)).body.data.assessment.decisionReason).toContain('no reason supplied');
  });
  it('cannot bypass configured-program reason requirements by omitting the client version flag', async () => {
    await configure(); const created = await request(app).post('/api/applications').auth(student, { type: 'bearer' }).send({ opportunityId: String(ids.scholarship), justification: 'Synthetic application through an older client into a configured programme.', selfDeclaredNeed: 'high' }); expect(created.status).toBe(201); const id = created.body.data.application._id;
    expect((await request(app).patch(`/api/applications/${id}/status`).auth(provider, { type: 'bearer' }).send({ status: 'accepted' })).status).toBe(400); expect((await assessment(id)).body.data.strictDecisions).toBe(true);
  });
  it('configures weights, snapshots policy history, freezes after application and never auto-awards', async () => {
    const weights = { need: 100, fit: 0, benefits: 0, timing: 0 }; expect((await configure(policyBody({ weights }))).status).toBe(200);
    const id = await apply('low'); const result = await assessment(id); expect(result.status).toBe(200); expect(result.body.data).toMatchObject({ status: 'applied', revision: 0, assessment: { policyRevision: 1, priority: { priorityScore: 33 } } });
    expect((await configure(policyBody({}, 1))).status).toBe(409); expect((await Application.findById(id))?.status).toBe('applied');
    const history = await request(app).get(`/api/scholarships/${ids.scholarship}/policy/history`).auth(provider, { type: 'bearer' }); expect(history.body.data.events[0]).toMatchObject({ action: 'policy_updated', revision: 1, policySnapshot: { weights } });
    const legacyList = await request(app).get(`/api/applications/opportunity/${ids.scholarship}`).auth(provider, { type: 'bearer' }); expect(legacyList.body.data.applications[0].priorityScore).toBe(33);
  });
  it('enforces configured programme/institution/year/skill rules before creating records', async () => {
    const rules = { ...defaultScholarshipPolicy().eligibility, degrees: ['ET'], institutions: ['Other University'], requiredSkills: ['Python'], minStudyYear: 3, maxStudyYear: 4 };
    await configure(policyBody({ eligibility: rules })); const rejected = await submit(); expect(rejected.status).toBe(409); expect(await Application.countDocuments()).toBe(0); expect(await ScholarshipReview.countDocuments()).toBe(0);
    const preview = await request(app).get(`/api/scholarships/${ids.scholarship}/policy`).auth(student, { type: 'bearer' }); expect(preview.body.data.eligibility.eligible).toBe(false);
  });
  it('serializes competing policy revisions and application-policy freeze', async () => {
    const revisions = await Promise.all([configure(), configure(policyBody({ weights: { need: 100, fit: 0, benefits: 0, timing: 0 } }))]); expect(revisions.map((row) => row.status).sort()).toEqual([200, 409]);
    expect(await ScholarshipEvent.countDocuments({ action: 'policy_updated' })).toBe(1);
    const [submission, editing] = await Promise.all([submit(), configure(policyBody({}, 1))]); expect(submission.status).toBe(201); expect([200, 409]).toContain(editing.status);
    const saved = await ScholarshipPolicy.findOne(); const review = await ScholarshipReview.findOne(); expect(review?.policyRevision).toBe(saved?.revision); expect(review?.policy.weights.need).toBe(saved?.settings.weights.need);
  });
  it('binds a common timing window and freezes published terms for the entire new cohort', async () => {
    const id = await apply(); const original = await ScholarshipReview.findOne({ applicationId: id });
    expect((await request(app).put(`/api/opportunities/${ids.scholarship}`).auth(provider, { type: 'bearer' }).send({ requiredSkills: ['Python'] })).status).toBe(409);
    expect((await request(app).put(`/api/opportunities/${ids.scholarship}`).auth(provider, { type: 'bearer' }).send({ applicationDeadline: '2099-02-01T00:00:00Z' })).status).toBe(200);
    const second = await apply('medium', outsider); const later = await ScholarshipReview.findOne({ applicationId: second }); expect(later?.timingEnd).toEqual(original?.timingEnd);
  });
  it('restricts policy writers and private assessment readers, including administrators', async () => {
    expect((await request(app).get(`/api/scholarships/${ids.scholarship}/policy`)).status).toBe(401);
    expect((await request(app).put(`/api/scholarships/${ids.scholarship}/policy`).auth(student, { type: 'bearer' }).send(policyBody())).status).toBe(403);
    expect((await request(app).put(`/api/scholarships/${ids.scholarship}/policy`).auth(otherProvider, { type: 'bearer' }).send(policyBody())).status).toBe(404);
    const id = await apply(); expect((await assessment(id, outsider)).status).toBe(404); expect((await assessment(id, otherProvider)).status).toBe(404); expect((await assessment(id, admin)).status).toBe(403); expect((await assessment(id, provider)).headers['cache-control']).toBe('no-store');
  });
  it('requires both application and listing ownership on legacy applicant feeds', async () => {
    const id = await apply(); await Opportunity.updateOne({ _id: ids.scholarship }, { providerId: ids.lecturer });
    expect((await request(app).get('/api/applications/provider').auth(provider, { type: 'bearer' })).body.data.applications).toEqual([]);
    expect((await request(app).get(`/api/applications/opportunity/${ids.scholarship}`).auth(otherProvider, { type: 'bearer' })).body.data.applications).toEqual([]); expect((await assessment(id, provider)).status).toBe(404);
  });
  it('rolls policy settings and lock increments back if audit persistence fails', async () => {
    vi.spyOn(ScholarshipEvent, 'create').mockRejectedValueOnce(new Error('Synthetic private audit failure'));
    const response = await configure(); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('private audit'); expect(await ScholarshipPolicy.countDocuments()).toBe(0); expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(0);
  });
  it('fixes ObjectId-based legacy previous-benefit counting without materializing decisions on reads', async () => {
    const other = new Types.ObjectId(); await Opportunity.create(scholarshipFixture({ _id: other }));
    await Application.create([applicationFixture(), applicationFixture({ opportunityId: other, status: 'accepted', appliedAt: new Date() })]);
    const response = await request(app).get(`/api/applications/opportunity/${ids.scholarship}`).auth(provider, { type: 'bearer' }); expect(response.body.data.applications[0].priorityReasons.join(' ')).toContain('Already holds 1'); expect(await ScholarshipReview.countDocuments()).toBe(0);
  });
});
describe('confidential supporting evidence', () => {
  it('requires evidence for award, exposes metadata only, and audits provider attachment access', async () => {
    await configure(policyBody({ eligibility: { ...defaultScholarshipPolicy().eligibility, requireEvidence: true } })); const id = await apply();
    expect((await decide(id, 'accepted')).status).toBe(409); const created = await upload(id); expect(created.status).toBe(201); const document = created.body.data.document; expect(document).not.toHaveProperty('data'); expect(document).not.toHaveProperty('sha256');
    const own = await request(app).get(`/api/applications/${id}/scholarship/evidence/${document._id}`).auth(student, { type: 'bearer' }); expect(own.status).toBe(200); expect(own.headers['content-disposition']).toContain('attachment'); expect(own.headers['x-content-type-options']).toBe('nosniff');
    expect((await request(app).get(`/api/applications/${id}/scholarship/evidence/${document._id}`).auth(provider, { type: 'bearer' })).status).toBe(403);
    const access = `/api/applications/${id}/scholarship/evidence/${document._id}/access`; expect((await request(app).post(access).auth(provider, { type: 'bearer' }).send({})).status).toBe(400);
    expect((await request(app).post(access).auth(provider, { type: 'bearer' }).send({ reason: 'Independent document review for this scholarship decision.' })).status).toBe(200); expect(await ScholarshipEvent.countDocuments({ action: 'evidence_accessed' })).toBe(1); expect(String((await ScholarshipEvent.findOne({ action: 'evidence_accessed' }))?.documentId)).toBe(document._id);
    expect((await decide(id, 'accepted')).status).toBe(200); expect((await assessment(id)).body.data.evidenceCount).toBe(1);
  });
  it('denies cross-student/provider/admin evidence access without leaking stored bytes', async () => {
    const id = await apply(); const document = (await upload(id)).body.data.document;
    expect((await upload(id, pdf('other'), outsider)).status).toBe(404);
    for (const actor of [outsider, otherProvider, admin]) { const response = await request(app).get(`/api/applications/${id}/scholarship/evidence`).auth(actor, { type: 'bearer' }); expect([403, 404]).toContain(response.status); expect(JSON.stringify(response.body)).not.toContain('synthetic.pdf'); }
    expect((await request(app).post(`/api/applications/${id}/scholarship/evidence/${document._id}/access`).auth(otherProvider, { type: 'bearer' }).send({ reason })).status).toBe(404);
    const files = await request(app).get(`/api/applications/${id}/scholarship/evidence`).auth(provider, { type: 'bearer' }); expect(files.body.data.documents[0]).not.toHaveProperty('data'); expect(files.body.data.documents[0]).not.toHaveProperty('sha256');
  });
  it('rejects malicious/malformed/oversized uploads, deduplicates, and caps evidence at three documents', async () => {
    const id = await apply(); expect((await upload(id, { fileName: 'unsafe.pdf', content: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /OpenAction /JS >> endobj\n%%EOF').toString('base64') })).status).toBe(400);
    expect((await upload(id, { fileName: 'test.pdf', content: 'invalid base64' })).status).toBe(400);
    expect((await upload(id, { fileName: 'large.pdf', content: Buffer.alloc(3 * 1024 * 1024).toString('base64') })).status).toBe(413);
    expect((await upload(id)).status).toBe(201); expect((await upload(id)).status).toBe(409); expect((await upload(id, pdf('two'))).status).toBe(201); expect((await upload(id, pdf('three'))).status).toBe(201); expect((await upload(id, pdf('four'))).status).toBe(409); expect(await ScholarshipEvidence.countDocuments()).toBe(3);
  });
  it('serializes concurrent attachments at the final evidence place', async () => {
    const id = await apply(); await upload(id); await upload(id, pdf('two')); const responses = await Promise.all([upload(id, pdf('three')), upload(id, pdf('four'))]); expect(responses.map((row) => row.status).sort()).toEqual([201, 409]); expect(await ScholarshipEvidence.countDocuments()).toBe(3);
  });
});
describe('reasoned human decisions, allocation protection and waitlists', () => {
  it('requires reasons for new decisions and prevents illegal reconsideration shortcuts', async () => {
    const id = await apply(); expect((await request(app).patch(`/api/applications/${id}/status`).auth(provider, { type: 'bearer' }).send({ status: 'accepted' })).status).toBe(400);
    expect((await decide(id, 'rejected', { revision: 0 })).status).toBe(200); expect((await decide(id, 'accepted', { revision: 1 })).status).toBe(409); expect((await decide(id, 'reviewed', { revision: 1 })).status).toBe(200); expect((await decide(id, 'accepted', { revision: 2 })).status).toBe(200);
    expect((await assessment(id)).body.data.assessment.decisionReason).toBe(reason);
  });
  it('retains exactly one last award under concurrent human approvals and idempotent retries', async () => {
    const first = await apply(); const second = await apply('high', outsider); const responses = await Promise.all([decide(first, 'accepted', { revision: 0 }), decide(second, 'accepted', { revision: 0 })]); expect(responses.map((row) => row.status).sort()).toEqual([200, 409]);
    const accepted = responses.find((row) => row.status === 200)!.body.data.application._id; expect((await decide(accepted, 'accepted', { revision: 0 })).status).toBe(200); expect(await Application.countDocuments({ status: 'accepted' })).toBe(1); expect(await ScholarshipEvent.countDocuments({ action: 'decision', toStatus: 'accepted' })).toBe(1);
  });
  it('persists ranked waitlists, advances only explicit human choices and never auto-fills freed places', async () => {
    await configure(policyBody({ weights: { need: 100, fit: 0, benefits: 0, timing: 0 } })); const first = await apply('high'); const second = await apply('low', outsider); await decide(first, 'waitlisted'); await decide(second, 'waitlisted');
    const path = `/api/scholarships/${ids.scholarship}/waitlist`; const queue = await request(app).get(path).auth(provider, { type: 'bearer' }); expect(queue.body.data.applications.map((row: { _id: string }) => row._id)).toEqual([first, second]); expect(queue.body.data.remaining).toBe(1); expect(await Application.countDocuments({ status: 'accepted' })).toBe(0);
    expect((await request(app).post(`${path}/advance`).auth(provider, { type: 'bearer' }).send({ applicationId: first, reason })).status).toBe(400);
    expect((await request(app).post(`${path}/advance`).auth(provider, { type: 'bearer' }).send({ applicationId: second, revision: 1, reason })).status).toBe(409);
    expect((await request(app).post(`${path}/advance`).auth(provider, { type: 'bearer' }).send({ applicationId: first, revision: 1, reason })).status).toBe(200); expect((await decide(first, 'rejected', { revision: 2 })).status).toBe(200);
    expect((await Application.findById(second))?.status).toBe('waitlisted'); expect(await Application.countDocuments({ status: 'accepted' })).toBe(0);
    expect((await request(app).post(`${path}/advance`).auth(provider, { type: 'bearer' }).send({ applicationId: second, revision: 1, reason })).status).toBe(200);
  });
  it('records a priority override without bypassing capacity or eligibility rules', async () => {
    await configure(policyBody({ weights: { need: 100, fit: 0, benefits: 0, timing: 0 }, eligibility: { ...defaultScholarshipPolicy().eligibility, degrees: ['ict'] } })); const first = await apply('high'); const second = await apply('low', outsider); await decide(first, 'waitlisted'); await decide(second, 'waitlisted');
    const override = 'Documented exceptional circumstances reviewed by the provider.'; const path = `/api/scholarships/${ids.scholarship}/waitlist/advance`;
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ applicationId: second, revision: 1, reason, priorityOverrideReason: override })).status).toBe(200);
    expect((await ScholarshipEvent.findOne({ applicationId: second, toStatus: 'accepted' }))?.priorityOverrideReason).toBe(override); expect((await decide(first, 'accepted', { priorityOverrideReason: override })).status).toBe(409);
    await decide(second, 'rejected'); await User.updateOne({ _id: ids.student }, { 'studentProfile.degree': 'ET' }); expect((await decide(first, 'accepted', { priorityOverrideReason: override })).status).toBe(409);
  });
  it('rolls back award, reason, history and locks when the decision event fails', async () => {
    const id = await apply(); const before = (await User.findById(ids.student))?.__v; const prior = (await Opportunity.findById(ids.scholarship))?.__v;
    vi.spyOn(ScholarshipEvent, 'create').mockRejectedValueOnce(new Error('Private synthetic event fault')); const response = await decide(id, 'accepted'); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('Private');
    expect((await Application.findById(id))?.status).toBe('applied'); expect((await ScholarshipReview.findOne({ applicationId: id }))?.decisionReason).toBeUndefined(); expect((await User.findById(ids.student))?.__v).toBe(before); expect((await Opportunity.findById(ids.scholarship))?.__v).toBe(prior);
  });
  it('keeps old default restrictions binding against a newly relaxed duplicate policy', async () => {
    const other = new Types.ObjectId(); await Opportunity.create(scholarshipFixture({ _id: other })); await configure(policyBody({ duplicateBenefitPolicy: 'allow_multiple' }), String(other));
    const first = await apply(); const second = await apply('high', student, String(other)); expect((await decide(first, 'accepted')).status).toBe(200); expect((await decide(second, 'accepted')).status).toBe(409);
  });
  it('allows multiple awards only when both policies explicitly permit them, including concurrent attempts', async () => {
    const other = new Types.ObjectId(); await Opportunity.create(scholarshipFixture({ _id: other })); await configure(policyBody({ duplicateBenefitPolicy: 'allow_multiple' })); await configure(policyBody({ duplicateBenefitPolicy: 'allow_multiple' }), String(other));
    const first = await apply(); const second = await apply('high', student, String(other)); const results = await Promise.all([decide(first, 'accepted'), decide(second, 'accepted')]); expect(results.map((row) => row.status)).toEqual([200, 200]); expect(await Application.countDocuments({ status: 'accepted' })).toBe(2);
  });
  it('fails closed on unclassified prior accepted allocations with missing source listings', async () => {
    await Application.create(applicationFixture({ opportunityId: new Types.ObjectId(), status: 'accepted', appliedAt: new Date() })); const id = await apply(); expect((await decide(id, 'accepted')).status).toBe(409); expect((await Application.findById(id))?.status).toBe('applied');
    await User.deleteOne({ _id: ids.student }); const feed = await request(app).get('/api/applications/provider').auth(provider, { type: 'bearer' }); expect(feed.status).toBe(200); expect(feed.body.data.applications[0].studentId).toBeNull();
  });
  it('requires a reason to recalculate priority and logs the new advisory snapshot', async () => {
    const id = await apply(); const path = `/api/applications/${id}/scholarship/recalculate`; expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({})).status).toBe(400);
    expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ reason: 'Reassessing the corrected applicant profile and current benefits.' })).status).toBe(200); expect(await ScholarshipEvent.countDocuments({ action: 'priority_recalculated' })).toBe(1); expect((await Application.findById(id))?.status).toBe('applied');
  });
});
describe('confidential appeals and retained allocation history', () => {
  it('serializes appeals, blocks competing decisions and reopens review without awarding', async () => {
    const id = await apply(); await decide(id, 'rejected'); const responses = await Promise.all([appeal(id), appeal(id)]); expect(responses.map((row) => row.status).sort()).toEqual([201, 409]); expect((await decide(id, 'reviewed')).status).toBe(409);
    const aid = responses.find((row) => row.status === 201)!.body.data.appeal._id; const path = `/api/applications/${id}/scholarship/appeals/${aid}/review`;
    expect((await request(app).post(path).auth(otherProvider, { type: 'bearer' }).send({ decision: 'reopened', reason })).status).toBe(404); expect((await request(app).post(path).auth(provider, { type: 'bearer' }).send({ decision: 'reopened', reason })).status).toBe(200);
    expect((await Application.findById(id))?.status).toBe('reviewed'); expect(await Application.countDocuments({ status: 'accepted' })).toBe(0); expect((await decide(id, 'accepted', { revision: 2 })).status).toBe(200);
  });
  it('upholds a decision without allowing repeated appeals of that same revision', async () => {
    const id = await apply(); await decide(id, 'rejected'); const aid = (await appeal(id)).body.data.appeal._id;
    expect((await request(app).post(`/api/applications/${id}/scholarship/appeals/${aid}/review`).auth(provider, { type: 'bearer' }).send({ decision: 'upheld', reason })).status).toBe(200); expect((await appeal(id)).status).toBe(409); expect((await Application.findById(id))?.status).toBe('rejected');
  });
  it('protects appeal ownership and rejects stale, ineligible or excessive appeal requests', async () => {
    const id = await apply(); expect((await appeal(id, 0)).status).toBe(409); await decide(id, 'rejected'); expect((await appeal(id, 0)).status).toBe(409); expect((await appeal(id, 1, outsider)).status).toBe(404);
    expect((await request(app).get(`/api/applications/${id}/scholarship/appeals`).auth(admin, { type: 'bearer' })).status).toBe(403);
    await ScholarshipAppeal.insertMany([0, 1, 2].map((decisionRevision) => ({ applicationId: id, studentId: ids.student, providerId: ids.provider, decisionRevision, statement: 'Synthetic previously reviewed appeal statement.', status: 'upheld' })));
    await Application.updateOne({ _id: id }, { scholarshipRevision: 4 }); expect((await appeal(id, 4)).status).toBe(409);
  });
  it('rolls back an appeal review if its audit event cannot be stored', async () => {
    const id = await apply(); await decide(id, 'rejected'); const aid = (await appeal(id)).body.data.appeal._id; vi.spyOn(ScholarshipEvent, 'create').mockRejectedValueOnce(new Error('Private appeal audit fault'));
    const response = await request(app).post(`/api/applications/${id}/scholarship/appeals/${aid}/review`).auth(provider, { type: 'bearer' }).send({ decision: 'reopened', reason }); expect(response.status).toBe(503); expect((await ScholarshipAppeal.findById(aid))?.status).toBe('pending'); expect((await Application.findById(id))?.status).toBe('rejected');
  });
  it('prevents provider deletion and retains moderated scholarship records without allowing new awards', async () => {
    const id = await apply(); await upload(id); expect((await request(app).delete(`/api/opportunities/${ids.scholarship}`).auth(provider, { type: 'bearer' })).status).toBe(409);
    expect((await request(app).delete(`/api/admin/opportunities/${ids.scholarship}`).auth(admin, { type: 'bearer' }).send({ reason: 'Withdraw public scholarship content while retaining application history.' })).status).toBe(200);
    expect((await Opportunity.findById(ids.scholarship))?.status).toBe('closed'); expect((await assessment(id)).body.data.withdrawnByAdmin).toBe(true); expect(await ScholarshipEvidence.countDocuments()).toBe(1); expect((await decide(id, 'accepted')).status).toBe(409);
    expect((await request(app).put(`/api/opportunities/${ids.scholarship}`).auth(provider, { type: 'bearer' }).send({ status: 'open' })).status).toBe(403); expect(await AuditLog.countDocuments({ action: 'scholarship_closed_with_history' })).toBe(1);
  });
  it('retains the same history when moderation removes a scholarship through a report', async () => {
    const id = await apply(); const report = await Report.create({ reporterId: ids.student, targetType: 'opportunity', targetId: ids.scholarship, reason: 'Synthetic scholarship content complaint.' });
    const response = await request(app).patch(`/api/admin/reports/${report._id}`).auth(admin, { type: 'bearer' }).send({ status: 'reviewed', resolutionNote: 'Public content removed while preserving the decision records.', removeTarget: true }); expect(response.status).toBe(200); expect((await Opportunity.findById(ids.scholarship))?.scholarshipWithdrawnByAdmin).toBe(true); expect((await assessment(id)).status).toBe(200);
  });
});
