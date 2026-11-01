import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import Conversation from '../../src/models/Conversation';
import Message from '../../src/models/Message';
import { CommunityClaim, CommunityClaimEvent } from '../../src/models/CommunityClaim';
import { VerificationEvent } from '../../src/models/ProviderVerification';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { decideProviderVerification, saveVerifiedProviderProfile, submitVerificationDocument } from '../../src/services/providerVerification';
import { TestDatabase } from '../support/database';
import { verificationUpload } from '../support/verification-document';
import { adminFixture, alumniFixture, ids, lecturerFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase();
const institution = 'University of Ruhuna'; const explanation = 'Synthetic evidence establishes my identity and institution affiliation for isolated tests.';
const approval = { identityConfirmed: true, affiliationConfirmed: true, affiliationMethod: 'institution_confirmation', affiliationReference: 'Private independent institution reference for synthetic tests only.', reason: 'Synthetic identity and affiliation independently reviewed.' };
const adminToken = generateToken(ids.admin.toString(), 'admin'); const studentToken = generateToken(ids.student.toString(), 'student');
const defaults = { visibility: 'members', acceptsStudentMessages: true, expertise: ['TypeScript'], availability: 'Weekday afternoons', bio: 'Synthetic member biography.' };
const member = (fixture: ReturnType<typeof lecturerFixture>) => ({ ...fixture, providerProfile: { ...fixture.providerProfile, verified: false, verificationStatus: 'PENDING' } });
async function token(id = ids.lecturer, full = false) { const user = await User.findById(id).select('+tokenVersion'); return full ? generateToken(id.toString(), 'provider', user!.tokenVersion || 0) : generateVerificationToken(id.toString(), user!.tokenVersion || 0); }
async function submit(id = ids.lecturer, directoryId = 'ict-chandana') {
  const upload = await submitVerificationDocument(id, verificationUpload());
  const response = await request(app).post('/api/community/claim').auth(await token(id), { type: 'bearer' }).send({ directoryId, documentId: upload.documentId, institution, justification: explanation, revision: 0 });
  expect(response.status).toBe(201); return response.body.data.claim;
}
async function review(claim: { providerId: string; documentId: string }) {
  expect((await request(app).get(`/api/admin/providers/${claim.providerId}/documents/${claim.documentId}`).auth(adminToken, { type: 'bearer' })).status).toBe(200);
}
async function decide(claim: { _id: string; revision: number; documentId: string }, action = 'approve', changes = {}) {
  return request(app).patch(`/api/admin/community-claims/${claim._id}/${action}`).auth(adminToken, { type: 'bearer' }).send({ ...approval, revision: claim.revision, documentId: claim.documentId, ...changes });
}
async function approve(id = ids.lecturer, directoryId = 'ict-chandana') { const claim = await submit(id, directoryId); await review(claim); const decision = await decide(claim); expect(decision.status).toBe(200); return decision.body.data.claim; }
async function preferences(profile = defaults, id = ids.lecturer) { const claim = await CommunityClaim.findOne({ providerId: id }); return request(app).put('/api/community/claim/profile').auth(await token(id), { type: 'bearer' }).send({ revision: claim!.revision, profile }); }
const people = () => request(app).get('/api/community/people').auth(studentToken, { type: 'bearer' });
const start = () => request(app).post('/api/messages/conversations').auth(studentToken, { type: 'bearer' }).send({ recipientId: ids.lecturer });
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); await User.create([adminFixture(), studentFixture(), member(lecturerFixture()), member(alumniFixture())]); });
afterAll(() => database.stop());

describe('community identity claims with a real isolated database', () => {
  it('requires owner authentication, faculty/alumni type and the claimant’s current private evidence', async () => {
    expect((await request(app).get('/api/community/claim')).status).toBe(401);
    expect((await request(app).get('/api/community/claim').auth(studentToken, { type: 'bearer' })).status).toBe(403);
    const upload = await submitVerificationDocument(ids.alumni, verificationUpload());
    const response = await request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send({ directoryId: 'ict-chandana', providerId: ids.alumni, documentId: upload.documentId, institution, justification: explanation, revision: 0 });
    expect(response.status).toBe(409); expect(await CommunityClaim.countDocuments()).toBe(0);
    expect((await request(app).get(`/api/provider-verification/documents/${upload.documentId}`).auth(await token(), { type: 'bearer' })).status).toBe(404);
  });
  it('submits a hidden claim and prevents cross-category/unrecognized institution claims', async () => {
    const claim = await submit(); expect(claim.profile).toMatchObject({ visibility: 'hidden', acceptsStudentMessages: false });
    const invalid = { directoryId: 'alumni-rishitha', documentId: claim.documentId, institution, justification: explanation, revision: 1 };
    expect((await request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send(invalid)).status).toBe(400);
    expect((await request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send({ ...invalid, directoryId: 'ict-chandana', institution: 'Unrelated University' })).status).toBe(400);
    expect(await CommunityClaimEvent.countDocuments({ action: 'submitted' })).toBe(1);
  });
  it('requires a fresh evidence review and independent identity/affiliation confirmations for approval', async () => {
    const claim = await submit(); expect((await decide(claim)).status).toBe(409);
    await review(claim);
    expect((await decide(claim, 'approve', { identityConfirmed: false })).status).toBe(400);
    expect((await decide(claim, 'approve', { affiliationConfirmed: false })).status).toBe(400);
    expect((await decide(claim, 'approve', { affiliationReference: 'too short' })).status).toBe(400);
    expect((await decide(claim)).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: 'community_claim_approved' })).toBe(1);
    expect((await CommunityClaim.findById(claim._id))?.status).toBe('APPROVED');
  });
  it('approves alumni using the correct catalog identity and preserves hidden defaults', async () => {
    await approve(ids.alumni, 'alumni-rishitha');
    expect((await people()).body.data.total).toBe(0);
    const login = await request(app).post('/api/auth/login').send({ email: 'alumni@example.test', password: testPassword });
    expect(login.status).toBe(200);
  });
  it('revokes previous sessions on approval and permits fresh verified-account login', async () => {
    const oldToken = await token(); await approve();
    expect((await request(app).get('/api/community/claim').auth(oldToken, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/api/community/claim').auth(await token(), { type: 'bearer' })).body.data.active).toBe(true);
    expect((await request(app).post('/api/auth/login').send({ email: 'lecturer@example.test', password: testPassword })).status).toBe(200);
  });
  it('handles request-info, correction, rejection and renewed submission with exact revisions', async () => {
    let claim = await submit(); expect((await decide(claim, 'request-info')).body.data.claim.status).toBe('NEEDS_INFO');
    const resubmit = async (revision: number) => request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send({ directoryId: claim.directoryId, documentId: claim.documentId, institution, justification: explanation, revision });
    expect((await resubmit(1)).status).toBe(409); claim = (await resubmit(2)).body.data.claim;
    expect((await decide(claim, 'reject')).body.data.claim.status).toBe('REJECTED'); claim = (await resubmit(4)).body.data.claim;
    expect(claim).toMatchObject({ status: 'PENDING', revision: 5 });
    expect(await CommunityClaimEvent.countDocuments()).toBe(5);
  });
  it('rejects stale evidence and stale revisions', async () => {
    const claim = await submit(); await review(claim);
    expect((await decide(claim, 'approve', { revision: 0 })).status).toBe(409);
    expect((await decide(claim, 'approve', { documentId: new Types.ObjectId() })).status).toBe(409);
    await submitVerificationDocument(ids.lecturer, verificationUpload());
    expect((await decide(claim)).status).toBe(409);
  });
  it('does not accept a document download that preceded the identity claim', async () => {
    const upload = await submitVerificationDocument(ids.lecturer, verificationUpload());
    await review({ providerId: ids.lecturer.toString(), documentId: upload.documentId.toString() });
    const response = await request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send({ directoryId: 'ict-chandana', documentId: upload.documentId, institution, justification: explanation, revision: 0 });
    expect(response.status).toBe(201); expect((await decide(response.body.data.claim)).status).toBe(409);
  });
  it('prevents a promoted claimant from approving their own identity', async () => {
    const claim = await submit(); await User.updateOne({ _id: ids.lecturer }, { role: 'admin' });
    const response = await request(app).patch(`/api/admin/community-claims/${claim._id}/approve`).auth(generateToken(ids.lecturer.toString(), 'admin'), { type: 'bearer' }).send({ ...approval, revision: claim.revision, documentId: claim.documentId });
    expect(response.status).toBe(403); expect((await CommunityClaim.findById(claim._id))?.status).toBe('PENDING');
  });
  it('rejects non-admin review and approval after account suspension', async () => {
    const claim = await submit(); await review(claim);
    expect((await request(app).get('/api/admin/community-claims').auth(studentToken, { type: 'bearer' })).status).toBe(403);
    await User.updateOne({ _id: ids.lecturer }, { accountStatus: 'suspended' });
    expect((await decide(claim)).status).toBe(403);
    expect((await CommunityClaim.findById(claim._id))?.status).toBe('PENDING');
  });
  it('prevents two accounts from obtaining the same directory identity under concurrent review', async () => {
    await User.create(member({ ...lecturerFixture(), _id: ids.outsider, email: 'other-claimant@example.test' }));
    const first = await submit(); const second = await submit(ids.outsider); await review(first); await review(second);
    const results = await Promise.all([decide(first), decide(second)]);
    expect(results.map((item) => item.status).sort()).toEqual([200, 409]);
    expect(await CommunityClaim.countDocuments({ directoryId: 'ict-chandana', status: 'APPROVED' })).toBe(1);
  });
  it('commits only one decision when administrators submit conflicting actions for the same revision', async () => {
    const claim = await submit(); await review(claim);
    const results = await Promise.all([decide(claim), decide(claim, 'reject')]);
    expect(results.map((item) => item.status).sort()).toEqual([200, 409]);
    expect(await CommunityClaimEvent.countDocuments({ action: { $in: ['approved', 'rejected'] } })).toBe(1);
  });
  it('rolls approval, provider activation, session changes and audit back if claim history fails', async () => {
    const claim = await submit(); await review(claim); const before = await User.findById(ids.lecturer).select('+tokenVersion').lean();
    const insert = vi.spyOn(CommunityClaimEvent, 'create').mockRejectedValueOnce(new Error('Synthetic history outage'));
    try { expect((await decide(claim)).status).toBe(503); } finally { insert.mockRestore(); }
    expect((await CommunityClaim.findById(claim._id))?.status).toBe('PENDING');
    expect(await User.findById(ids.lecturer).select('+tokenVersion').lean()).toEqual(before);
    expect(await AuditLog.countDocuments({ action: 'community_claim_approved' })).toBe(0);
    expect(await VerificationEvent.countDocuments({ action: 'verified' })).toBe(0);
  });
  it('returns private claim history only to its owner/admin, with review references admin-only', async () => {
    const claim = await approve();
    const owner = await request(app).get('/api/community/claim/history').auth(await token(), { type: 'bearer' });
    expect(owner.body.data.entries).toHaveLength(2); expect(JSON.stringify(owner.body)).not.toContain(approval.affiliationReference);
    expect((await request(app).get('/api/community/claim/history').auth(await token(ids.alumni), { type: 'bearer' })).status).toBe(404);
    const admin = await request(app).get(`/api/admin/community-claims/${claim._id}/history`).auth(adminToken, { type: 'bearer' });
    expect(JSON.stringify(admin.body)).toContain(approval.affiliationReference);
  });
  it('applies queue filters, validates pagination and returns no private evidence bytes', async () => {
    await submit(); await submit(ids.alumni, 'alumni-rishitha');
    const response = await request(app).get('/api/admin/community-claims?category=academic&department=ICT&q=Chandana').auth(adminToken, { type: 'bearer' });
    expect(response.body.data.total).toBe(1); expect(JSON.stringify(response.body)).not.toContain('sha256'); expect(JSON.stringify(response.body)).not.toContain('password');
    expect((await request(app).get('/api/admin/community-claims?page=0').auth(adminToken, { type: 'bearer' })).status).toBe(400);
    expect((await request(app).get('/api/admin/community-claims?status=bad').auth(adminToken, { type: 'bearer' })).status).toBe(400);
  });
  it('limits claim submissions atomically under concurrent requests', async () => {
    let claim = await submit();
    const resubmit = async (revision: number) => request(app).post('/api/community/claim').auth(await token(), { type: 'bearer' }).send({ directoryId: 'ict-chandana', documentId: claim.documentId, institution, justification: explanation, revision });
    for (let index = 1; index < 5; index++) claim = (await resubmit(claim.revision)).body.data.claim;
    const results = await Promise.all([resubmit(claim.revision), resubmit(claim.revision)]);
    expect(results.every((response) => response.status === 429)).toBe(true);
    expect(await CommunityClaimEvent.countDocuments({ action: 'submitted' })).toBe(5);
  });
});

describe('community visibility and continuing messaging consent', () => {
  it('does not expose legacy providers, pending claims or hidden approved profiles', async () => {
    await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    expect((await people()).body.data.total).toBe(0);
    expect((await start()).status).toBe(403);
    await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'PENDING' });
    await approve(); expect((await people()).body.data.total).toBe(0);
    expect((await request(app).get('/api/community/people').auth(await token(), { type: 'bearer' })).status).toBe(401);
  });
  it('discovers approved opted-in members by stable ID, department and expertise with a private allowlist', async () => {
    await approve(); expect((await preferences()).status).toBe(200);
    const response = await request(app).get('/api/community/people?category=academic&department=ICT&q=TypeScript').auth(studentToken, { type: 'bearer' });
    expect(response.body.data.people[0]).toMatchObject({ _id: ids.lecturer.toString(), directoryId: 'ict-chandana', acceptsStudentMessages: true });
    const encoded = JSON.stringify(response.body); for (const field of ['documentId', 'providerId', 'justification', 'decisionReason', 'email', 'affiliationReference', 'password']) expect(encoded).not.toContain(field);
    expect((await request(app).get('/api/messages/directory').auth(studentToken, { type: 'bearer' })).body.data.total).toBe(1);
    expect((await request(app).get('/api/community/people?department=ET').auth(studentToken, { type: 'bearer' })).body.data.total).toBe(0);
  });
  it('allows student-initiated messages and faculty replies, but refuses unsolicited faculty starts', async () => {
    await approve(); await preferences();
    const facultyToken = await token(ids.lecturer, true);
    expect((await request(app).post('/api/messages/conversations').auth(facultyToken, { type: 'bearer' }).send({ recipientId: ids.student })).status).toBe(403);
    const conversation = (await start()).body.data.conversation; expect(conversation.initiatedBy).toBe(ids.student.toString());
    expect((await request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' }).send({ content: 'Synthetic student question' })).status).toBe(201);
    expect((await request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(facultyToken, { type: 'bearer' }).send({ content: 'Synthetic faculty reply' })).status).toBe(201);
    expect((await request(app).get(`/api/messages/conversations/${conversation._id}/messages`).auth(adminToken, { type: 'bearer' })).status).toBe(404);
  });
  it('hides profiles and blocks further sends in existing conversations while preserving participant history', async () => {
    await approve(); await preferences(); const conversation = (await start()).body.data.conversation;
    await request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' }).send({ content: 'Existing private history' });
    expect((await preferences({ ...defaults, visibility: 'hidden' })).status).toBe(200);
    expect((await people()).body.data.total).toBe(0);
    expect((await request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' }).send({ content: 'Blocked after privacy withdrawal' })).status).toBe(403);
    const history = await request(app).get(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' });
    expect(history.status).toBe(200); expect(history.body.data.messages).toHaveLength(1);
  });
  it('honors messaging opt-out separately from directory visibility', async () => {
    await approve(); await preferences({ ...defaults, acceptsStudentMessages: false });
    expect((await people()).body.data.total).toBe(1); expect((await start()).status).toBe(403);
  });
  it('serializes concurrent preference withdrawal and sends without losing the withdrawal', async () => {
    await approve(); await preferences(); const conversation = (await start()).body.data.conversation;
    const send = () => request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' }).send({ content: 'Concurrent consent check' });
    const [message, withdrawal] = await Promise.all([send(), preferences({ ...defaults, acceptsStudentMessages: false })]);
    expect(withdrawal.status).toBe(200); expect([201, 403]).toContain(message.status);
    expect((await send()).status).toBe(403);
    expect((await CommunityClaim.findOne({ providerId: ids.lecturer }))?.profile.acceptsStudentMessages).toBe(false);
    expect(await Message.countDocuments()).toBe(message.status === 201 ? 1 : 0);
  });
  it('invalidates an approved claim after identity edits and cannot restore it using the old provider flag', async () => {
    await approve(); await preferences(); const provider = await User.findById(ids.lecturer);
    await saveVerifiedProviderProfile(ids.lecturer, provider!.__v, { contactPerson: 'Changed identity details' });
    expect((await CommunityClaim.findOne({ providerId: ids.lecturer }))?.status).toBe('NEEDS_INFO');
    await User.updateOne({ _id: ids.lecturer }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    expect((await people()).body.data.total).toBe(0); expect((await start()).status).toBe(403);
  });
  it('invalidates claims when generic provider verification is withdrawn', async () => {
    const claim = await approve(); await preferences();
    await decideProviderVerification(ids.admin, ids.lecturer.toString(), 'more_info', { documentId: claim.documentId, reason: 'Recheck institution affiliation evidence.' });
    expect((await CommunityClaim.findOne({ providerId: ids.lecturer }))?.status).toBe('NEEDS_INFO');
    expect(await CommunityClaimEvent.countDocuments({ action: 'verification_changed' })).toBe(1);
  });
  it('supports explicit revocation with history and immediately withdraws visibility', async () => {
    let claim = await approve(); await preferences(); claim = (await CommunityClaim.findById(claim._id))!.toObject();
    const revoked = await decide(claim, 'revoke'); expect(revoked.status).toBe(200); expect(revoked.body.data.claim.status).toBe('REVOKED');
    expect((await people()).body.data.total).toBe(0); expect(await AuditLog.countDocuments({ action: 'community_claim_revoked' })).toBe(1);
  });
  it('allows an administrator to revoke a suspended member without reinstating them', async () => {
    const claim = await approve(); await User.updateOne({ _id: ids.lecturer }, { accountStatus: 'suspended' });
    expect((await decide(claim, 'revoke')).status).toBe(200);
    expect((await User.findById(ids.lecturer))?.accountStatus).toBe('suspended');
  });
  it('never publishes community biographies or evidence through the generic provider-profile API', async () => {
    await approve(); await preferences({ ...defaults, visibility: 'hidden', bio: 'Private community biography marker' });
    const response = await request(app).get(`/api/providers/${ids.lecturer}`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('Private community biography marker');
    expect(JSON.stringify(response.body)).not.toContain('documentId');
    expect((await people()).headers['cache-control']).toBe('no-store');
  });
  it('refuses further messages if the community recipient account is deleted', async () => {
    await approve(); await preferences(); const conversation = (await start()).body.data.conversation;
    await User.deleteOne({ _id: ids.lecturer });
    expect((await request(app).post(`/api/messages/conversations/${conversation._id}/messages`).auth(studentToken, { type: 'bearer' }).send({ content: 'No recipient remains' })).status).toBe(403);
    expect(await Message.countDocuments()).toBe(0);
  });
  it('rejects forged profile ownership/status fields and stale privacy updates', async () => {
    const claim = await submit();
    expect((await preferences({ ...defaults, status: 'APPROVED' } as typeof defaults)).status).toBe(400);
    expect((await preferences()).status).toBe(200);
    expect((await request(app).put('/api/community/claim/profile').auth(await token(), { type: 'bearer' }).send({ revision: claim.revision, profile: defaults })).status).toBe(409);
    expect((await CommunityClaim.findById(claim._id))?.status).toBe('PENDING');
  });
});
