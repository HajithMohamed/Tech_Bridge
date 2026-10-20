import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import Resource from '../../src/models/Resource';
import { VerificationDocument, VerificationEvent } from '../../src/models/ProviderVerification';
import { generateToken, generateVerificationToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, resourceFixture, studentFixture, testPassword } from '../support/fixtures';
import { verificationPng, verificationUpload } from '../support/verification-document';

let app = createApp(); const database = new TestDatabase();
const pending = providerFixture(); pending.providerProfile.verified = false; pending.providerProfile.verificationStatus = 'PENDING';
const admin = (id = ids.admin) => generateToken(id.toString(), 'admin');
const restricted = (id = ids.provider, version = 0) => generateVerificationToken(id.toString(), version);
const upload = (name?: string, token = restricted()) => request(app).post('/api/provider-verification/documents').auth(token, { type: 'bearer' }).send(verificationUpload(name));
const decision = (action: string, documentId: string | null, reason = 'Synthetic evidence reviewed', actor = ids.admin) => request(app).patch(`/api/admin/providers/${ids.provider}/${action}`).auth(admin(actor), { type: 'bearer' }).send({ documentId, reason });
const review = (documentId: string, actor = ids.admin) => request(app).get(`/api/admin/providers/${ids.provider}/documents/${documentId}`).auth(admin(actor), { type: 'bearer' });
const session = (email = 'provider@example.test', password = testPassword) => request(app).post('/api/provider-verification/session').send({ email, password });
beforeAll(() => database.start());
beforeEach(async () => { app = createApp(); await database.clear(); await User.create([adminFixture(), studentFixture(), pending]); });
afterAll(() => database.stop());

describe('provider verification with real MongoDB and private evidence', () => {
  it('issues restricted credentials while denying general platform and admin access', async () => {
    const login = await session(); expect(login.status).toBe(200); expect(login.body.data.expiresIn).toBe(900); const token = login.body.data.token;
    expect((await request(app).get('/api/provider-verification').auth(token, { type: 'bearer' })).status).toBe(200);
    for (const path of ['/api/auth/me', '/api/provider/dashboard', '/api/admin/users', '/api/messages/conversations']) expect((await request(app).get(path).auth(token, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).get('/api/auth/me').auth(generateToken(ids.provider.toString(), 'provider'), { type: 'bearer' })).status).toBe(403);
    expect((await request(app).post('/api/auth/login').send({ email: pending.email, password: testPassword })).status).toBe(403);
  });
  it('rejects invalid credentials, nonproviders, suspended providers and unauthenticated access', async () => {
    expect((await session('missing@example.test')).status).toBe(401); expect((await session(pending.email, 'Incorrect synthetic password')).status).toBe(401); expect((await session('student@example.test')).status).toBe(401);
    expect((await request(app).get('/api/provider-verification')).status).toBe(401);
    expect((await request(app).get('/api/provider-verification').auth(generateToken(ids.student.toString(), 'provider'), { type: 'bearer' })).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'suspended' }); expect((await session()).status).toBe(403); expect((await upload()).status).toBe(403);
  });
  it('ignores client-forged evidence references and decisions during registration', async () => {
    const registration = await request(app).post('/api/auth/register').send({ ...pending, email: 'new-provider@example.test', confirmPassword: testPassword, tokenVersion: 100, providerProfile: { ...pending.providerProfile, verified: true, verificationStatus: 'VERIFIED', verificationDocumentId: ids.resource, verificationDocumentName: 'fake.png', rejectionReason: 'Forged approval' } });
    expect(registration.status).toBe(201); expect(registration.body.data).not.toHaveProperty('token');
    expect(registration.body.data.user.providerProfile).toMatchObject({ verified: false, verificationStatus: 'PENDING' });
    for (const field of ['verificationDocumentId', 'verificationDocumentName', 'rejectionReason']) expect(registration.body.data.user.providerProfile).not.toHaveProperty(field);
    expect(await VerificationDocument.countDocuments()).toBe(0);
  });
  it('stores bytes privately, exposes safe metadata and downloads only as an opaque attachment', async () => {
    const created = await upload(); expect(created.status).toBe(201); const id = created.body.data.documentId;
    const state = await request(app).get('/api/provider-verification').auth(restricted(), { type: 'bearer' });
    expect(state.body.data.document).toMatchObject({ _id: id, fileName: 'synthetic-evidence.png', contentType: 'image/png', size: verificationPng.length });
    expect(state.headers['cache-control']).toBe('no-store'); expect(state.body.data.document).not.toHaveProperty('data'); expect(state.body.data.document).not.toHaveProperty('sha256');
    expect((await VerificationDocument.findById(id))?.data).toBeUndefined();
    const result = await request(app).get(`/api/provider-verification/documents/${id}`).auth(restricted(), { type: 'bearer' });
    expect(result.status).toBe(200); expect(result.body).toEqual(verificationPng); expect(result.headers['content-type']).toBe('application/octet-stream'); expect(result.headers['content-disposition']).toBe(`attachment; filename="verification-${id}.png"`);
    expect(result.headers['cache-control']).toBe('no-store'); expect(result.headers['x-content-type-options']).toBe('nosniff'); expect(result.headers['content-security-policy']).toContain('sandbox');
    expect(await VerificationEvent.countDocuments({ action: 'submitted' })).toBe(1);
  });
  it('prevents document IDOR, including mismatched admin provider/document pairs', async () => {
    const id = (await upload()).body.data.documentId;
    await User.create({ ...pending, _id: ids.outsider, email: 'outsider@example.test' });
    expect((await request(app).get(`/api/provider-verification/documents/${id}`).auth(restricted(ids.outsider), { type: 'bearer' })).status).toBe(404);
    expect((await request(app).get(`/api/provider-verification/documents/${id}`)).status).toBe(401);
    expect((await request(app).get(`/api/admin/providers/${ids.outsider}/documents/${id}`).auth(admin(), { type: 'bearer' })).status).toBe(404);
    expect((await request(app).get(`/api/admin/providers/${ids.provider}/documents/${id}`).auth(generateToken(ids.student.toString(), 'admin'), { type: 'bearer' })).status).toBe(403);
    expect((await request(app).get('/api/provider-verification/documents/invalid').auth(restricted(), { type: 'bearer' })).status).toBe(400);
    expect(await VerificationEvent.countDocuments({ action: 'document_reviewed' })).toBe(0);
  });
  it('requires real evidence, explicit current document and bounded decision reasons', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationDocumentName': 'legacy-filename.pdf' });
    expect((await decision('verify', null)).status).toBe(409);
    for (const reason of ['', 'ab', 'x'.repeat(1001)]) expect((await decision('reject', null, reason)).status).toBe(400);
    expect((await request(app).patch(`/api/admin/providers/${ids.provider}/verify`).auth(admin(), { type: 'bearer' }).send({ reason: 'Missing document ID' })).status).toBe(400);
    expect((await User.findById(ids.provider))?.providerProfile?.verified).toBe(false); expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('requires the acting admin to download evidence and atomically approves with a notice and fresh login', async () => {
    const id = (await upload()).body.data.documentId;
    expect((await decision('verify', id)).status).toBe(409);
    await User.create({ ...adminFixture(), _id: ids.lecturer, email: 'other-admin@example.test' });
    expect((await review(id, ids.lecturer)).status).toBe(200); expect((await decision('verify', id)).status).toBe(409);
    expect((await review(id)).status).toBe(200); expect((await decision('verify', id)).status).toBe(200);
    const provider = await User.findById(ids.provider).select('+tokenVersion'); expect(provider?.providerProfile).toMatchObject({ verified: true, verificationStatus: 'VERIFIED' }); expect(provider?.tokenVersion).toBe(1);
    const audit = await AuditLog.findOne({ action: 'provider_verified' }); expect(audit).toMatchObject({ adminId: ids.admin, targetId: ids.provider, reason: 'Synthetic evidence reviewed', before: { verificationStatus: 'PENDING' }, after: { verificationStatus: 'VERIFIED' } });
    expect((await request(app).get('/api/provider-verification').auth(restricted(), { type: 'bearer' })).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: pending.email, password: testPassword }); expect(login.status).toBe(200); expect((await request(app).get('/api/auth/me').auth(login.body.data.token, { type: 'bearer' })).status).toBe(200);
    expect((await request(app).get('/api/provider-verification').auth((await session()).body.data.token, { type: 'bearer' })).body.data.unread).toBe(1);
    const publicProfile = await request(app).get(`/api/providers/${ids.provider}`); expect(publicProfile.status).toBe(200);
    for (const field of ['verificationDocumentId', 'verificationDocumentName', 'rejectionReason']) expect(publicProfile.body.data.provider.providerProfile).not.toHaveProperty(field);
  });
  it('records a rejection, exposes its reason only to the owner/admin and supports owned read state', async () => {
    expect((await decision('reject', null, 'Affiliation evidence is missing')).status).toBe(200);
    const token = (await session()).body.data.token;
    const state = await request(app).get('/api/provider-verification').auth(token, { type: 'bearer' }); expect(state.body.data.provider).toMatchObject({ status: 'REJECTED', reason: 'Affiliation evidence is missing' }); expect(state.body.data.unread).toBe(1);
    expect((await request(app).post('/api/auth/login').send({ email: pending.email, password: testPassword })).status).toBe(403);
    const entry = await VerificationEvent.findOne({ action: 'rejected' });
    await User.create({ ...pending, _id: ids.outsider, email: 'outsider@example.test' });
    const path = `/api/provider-verification/history/${entry!._id}/read`;
    expect((await request(app).patch(path).auth(restricted(ids.outsider), { type: 'bearer' })).status).toBe(404);
    for (let index = 0; index < 2; index++) expect((await request(app).patch(path).auth(token, { type: 'bearer' })).status).toBe(200);
    expect((await request(app).get('/api/provider-verification').auth(token, { type: 'bearer' })).body.data.unread).toBe(0);
    const publicProfile = await request(app).get(`/api/providers/${ids.provider}`); expect(JSON.stringify(publicProfile.body)).not.toContain('Affiliation evidence is missing');
    expect((await upload('resubmission.png', token)).status).toBe(201); expect((await User.findById(ids.provider))?.providerProfile?.verificationStatus).toBe('PENDING');
  });
  it('requests information, accepts corrections and prevents approving an obsolete document', async () => {
    const oldId = (await upload()).body.data.documentId; expect((await review(oldId)).status).toBe(200);
    expect((await decision('request-info', oldId, 'Please provide affiliation confirmation')).status).toBe(200);
    expect((await decision('verify', oldId)).status).toBe(409);
    const token = (await session()).body.data.token; const newId = (await upload('correction.png', token)).body.data.documentId;
    expect(newId).not.toBe(oldId); expect((await User.findById(ids.provider))?.providerProfile?.rejectionReason).toBeUndefined();
    expect((await decision('verify', oldId)).status).toBe(409); expect((await decision('verify', newId)).status).toBe(409);
    expect((await review(newId)).status).toBe(200); expect((await decision('verify', newId)).status).toBe(200);
    expect(await VerificationEvent.countDocuments({ action: 'submitted' })).toBe(2);
  });
  it('withdraws verified access for additional information without reinstating a suspended account', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED', accountStatus: 'suspended' });
    expect((await decision('request-info', null, 'Organization affiliation must be reconfirmed')).status).toBe(200);
    const provider = await User.findById(ids.provider); expect(provider?.providerProfile).toMatchObject({ verified: false, verificationStatus: 'NEEDS_INFO' }); expect(provider?.accountStatus).toBe('suspended');
    expect((await session()).status).toBe(403); expect((await upload()).status).toBe(401);
  });
  it('removes stale public resource badges on withdrawal and restores them only after actual approval', async () => {
    const id = (await upload()).body.data.documentId; await review(id); expect((await decision('verify', id)).status).toBe(200);
    await Resource.create(resourceFixture());
    expect((await request(app).get(`/api/resources/${ids.resource}`)).body.data.resource.providerOrgVerified).toBe(true);
    expect((await decision('request-info', id, 'Affiliation must be checked again')).status).toBe(200);
    const single = await request(app).get(`/api/resources/${ids.resource}`); const list = await request(app).get('/api/resources'); const profile = await request(app).get(`/api/providers/${ids.provider}`);
    expect(single.body.data.resource.providerOrgVerified).toBe(false); expect(list.body.data.resources[0].providerOrgVerified).toBe(false); expect(profile.body.data.resources[0].providerOrgVerified).toBe(false);
    // The legacy cached database value is retained; the public response is current.
    expect((await Resource.findById(ids.resource))?.providerOrgVerified).toBe(true);
    const currentToken = (await session()).body.data.token; const nextId = (await upload('updated-evidence.png', currentToken)).body.data.documentId; await review(nextId); expect((await decision('verify', nextId)).status).toBe(200);
    expect((await request(app).get(`/api/resources/${ids.resource}`)).body.data.resource.providerOrgVerified).toBe(true);
  });
  it('does not approve a suspended provider or replace verified evidence without a review request', async () => {
    const id = (await upload()).body.data.documentId; await review(id);
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'suspended' }); expect((await decision('verify', id)).status).toBe(409);
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'active', 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    expect((await upload()).status).toBe(409); expect(await VerificationDocument.countDocuments()).toBe(1);
  });
  it('serializes concurrent quota use and permits another upload after the rolling window', async () => {
    for (let index = 0; index < 4; index++) expect((await upload(`evidence-${index}.png`)).status).toBe(201);
    const results = await Promise.all([upload('evidence-4.png'), upload('evidence-5.png')]); expect(results.map((result) => result.status).sort()).toEqual([201, 429]); expect(await VerificationDocument.countDocuments()).toBe(5);
    await VerificationDocument.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } }); expect((await upload('next-window.png')).status).toBe(201);
  });
  it('allows only one of two concurrent administrator decisions', async () => {
    await User.create({ ...adminFixture(), _id: ids.lecturer, email: 'other-admin@example.test' });
    const id = (await upload()).body.data.documentId; await review(id);
    const results = await Promise.all([decision('verify', id), decision('reject', id, 'Organization evidence was rejected', ids.lecturer)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]); expect(await VerificationEvent.countDocuments({ action: { $in: ['verified', 'rejected'] } })).toBe(1); expect(await AuditLog.countDocuments({ action: { $in: ['provider_verified', 'provider_rejected'] } })).toBe(1);
  });
  it('cannot approve newly replaced evidence during a concurrent upload', async () => {
    const oldId = (await upload()).body.data.documentId; await review(oldId);
    const results = await Promise.all([decision('verify', oldId), upload('replacement.png')]);
    expect(results.filter((result) => [200, 201].includes(result.status))).toHaveLength(1);
    expect(results.every((result) => [200, 201, 401, 409].includes(result.status))).toBe(true);
    const provider = await User.findById(ids.provider);
    if (provider?.providerProfile?.verified) expect(provider.providerProfile.verificationDocumentId?.toString()).toBe(oldId);
    else expect(provider?.providerProfile?.verificationDocumentId?.toString()).not.toBe(oldId);
  });
  it('rolls back status, session version and notice if audit persistence fails', async () => {
    const id = (await upload()).body.data.documentId; await review(id);
    vi.spyOn(AuditLog, 'create').mockImplementationOnce(() => { throw new Error('Private database details'); });
    const result = await decision('verify', id); expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('Private');
    const provider = await User.findById(ids.provider).select('+tokenVersion'); expect(provider?.providerProfile?.verificationStatus).toBe('PENDING'); expect(provider?.tokenVersion).toBe(0); expect(await VerificationEvent.countDocuments({ action: 'verified' })).toBe(0);
  });
  it('does not release document bytes or a review event if download auditing fails', async () => {
    const id = (await upload()).body.data.documentId;
    vi.spyOn(AuditLog, 'create').mockImplementationOnce(() => { throw new Error('Private database details'); });
    const result = await review(id); expect(result.status).toBe(503); expect(result.headers['content-type']).toContain('application/json'); expect(await VerificationEvent.countDocuments({ action: 'document_reviewed' })).toBe(0);
  });
  it('rolls back stored evidence and current-document references if submission history fails', async () => {
    vi.spyOn(VerificationEvent, 'create').mockImplementationOnce(() => { throw new Error('Private database details'); });
    expect((await upload()).status).toBe(503); expect(await VerificationDocument.countDocuments()).toBe(0); expect((await User.findById(ids.provider))?.providerProfile?.verificationDocumentId).toBeUndefined();
  });
  it('rejects unsupported, oversized and malformed uploads without storing data', async () => {
    for (const body of [{ ...verificationUpload(), fileName: '../proof.png' }, { ...verificationUpload(), fileName: 'spoof.pdf' }, { ...verificationUpload(), content: 'invalid=' }, { ...verificationUpload(), content: Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64') }]) {
      const result = await request(app).post('/api/provider-verification/documents').auth(restricted(), { type: 'bearer' }).send(body); expect([400, 413]).toContain(result.status);
    }
    expect(await VerificationDocument.countDocuments()).toBe(0); expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it('paginates providers and escapes search while rejecting invalid filters', async () => {
    await User.insertMany(Array.from({ length: 22 }, (_, index) => ({ ...pending, _id: new Types.ObjectId(), email: `queue-${index}@example.test` })));
    const first = await request(app).get('/api/admin/providers').auth(admin(), { type: 'bearer' }); const second = await request(app).get('/api/admin/providers?page=2').auth(admin(), { type: 'bearer' });
    expect(first.body.data.providers).toHaveLength(20); expect(second.body.data.providers).toHaveLength(3); expect(second.body.data.total).toBe(23);
    expect((await request(app).get('/api/admin/providers?q=Support%20Organization').auth(admin(), { type: 'bearer' })).body.data.total).toBe(23);
    expect((await request(app).get('/api/admin/providers?q=.*').auth(admin(), { type: 'bearer' })).body.data.total).toBe(0);
    for (const query of ['status=UNKNOWN', 'page=0', 'q=x&q=y']) expect((await request(app).get(`/api/admin/providers?${query}`).auth(admin(), { type: 'bearer' })).status).toBe(400);
  });
  it('paginates private history, hides actor email and enforces notice ownership/type', async () => {
    await VerificationEvent.insertMany(Array.from({ length: 23 }, () => ({ providerId: ids.provider, actorId: ids.admin, action: 'more_info', fromStatus: 'PENDING', toStatus: 'NEEDS_INFO', reason: 'Synthetic history reason' })));
    const own = await request(app).get('/api/provider-verification/history?page=2').auth(restricted(), { type: 'bearer' }); expect(own.body.data.entries).toHaveLength(3); expect(own.body.data.total).toBe(23); expect(own.body.data.entries[0].actorId.fullName).toBe('Synthetic Admin'); expect(JSON.stringify(own.body)).not.toContain('admin@example.test');
    const history = await request(app).get(`/api/admin/providers/${ids.provider}/history`).auth(admin(), { type: 'bearer' }); expect(history.body.data.entries).toHaveLength(20);
    expect((await request(app).get(`/api/admin/providers/${ids.outsider}/history`).auth(admin(), { type: 'bearer' })).status).toBe(404);
    const id = (await upload()).body.data.documentId; const event = await VerificationEvent.findOne({ documentId: id }); expect((await request(app).patch(`/api/provider-verification/history/${event!._id}/read`).auth(restricted(), { type: 'bearer' })).status).toBe(404);
  });
  it('limits failed verification sessions and returns a retry interval', async () => {
    for (let index = 0; index < 10; index++) expect((await session('absent@example.test', 'Wrong synthetic password')).status).toBe(401);
    const result = await session('absent@example.test'); expect(result.status).toBe(429); expect(result.headers['retry-after']).toBe('900');
  });
  it('requires new verification after identity edits, revokes access and records the self-service change', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    const oldToken = generateToken(ids.provider.toString(), 'provider');
    const result = await request(app).put('/api/provider/profile').auth(oldToken, { type: 'bearer' }).send({ organizationName: 'Changed Synthetic Organization', verified: true, verificationStatus: 'VERIFIED' });
    expect(result.status).toBe(200); expect(result.body.data.user.providerProfile).toMatchObject({ organizationName: 'Changed Synthetic Organization', verified: false, verificationStatus: 'NEEDS_INFO' });
    expect((await request(app).get('/api/auth/me').auth(oldToken, { type: 'bearer' })).status).toBe(401);
    const event = await VerificationEvent.findOne({ action: 'profile_changed' }); expect(event).toMatchObject({ actorId: ids.provider, fromStatus: 'VERIFIED', toStatus: 'NEEDS_INFO' });
    expect((await request(app).post('/api/auth/login').send({ email: pending.email, password: testPassword })).status).toBe(403);
    const token = (await session()).body.data.token; expect((await upload('updated-identity.png', token)).status).toBe(201);
  });
  it('preserves verification for ordinary service/description edits and rejects invalid text types', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    const token = generateToken(ids.provider.toString(), 'provider');
    expect((await request(app).put('/api/provider/profile').auth(token, { type: 'bearer' }).send({ phone: {} })).status).toBe(400);
    const result = await request(app).put('/api/provider/profile').auth(token, { type: 'bearer' }).send({ description: 'Updated description for a synthetic organization.', opportunityCategories: ['mentorship'], verified: false, verificationStatus: 'PENDING' });
    expect(result.status).toBe(200); expect(result.body.data.user.providerProfile).toMatchObject({ verified: true, verificationStatus: 'VERIFIED', opportunityCategories: ['mentorship'] });
    expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(200); expect(await VerificationEvent.countDocuments()).toBe(0);
  });
  it('rolls back an identity edit when its verification history cannot be persisted', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    vi.spyOn(VerificationEvent, 'create').mockImplementationOnce(() => { throw new Error('Private database details'); });
    const result = await request(app).put('/api/provider/profile').auth(generateToken(ids.provider.toString(), 'provider'), { type: 'bearer' }).send({ organizationName: 'Uncommitted Organization' });
    expect(result.status).toBe(503); const provider = await User.findById(ids.provider).select('+tokenVersion'); expect(provider?.providerProfile?.organizationName).toBe(pending.providerProfile.organizationName); expect(provider?.providerProfile?.verified).toBe(true); expect(provider?.tokenVersion).toBe(0);
  });
  it('cannot overwrite a concurrent verification withdrawal with a stale profile update', async () => {
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' });
    const results = await Promise.all([decision('request-info', null, 'Affiliation needs to be reconfirmed'), request(app).put('/api/provider/profile').auth(generateToken(ids.provider.toString(), 'provider'), { type: 'bearer' }).send({ organizationName: 'Concurrent Organization' })]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1); expect(results.every((result) => [200, 401, 403, 409].includes(result.status))).toBe(true);
    expect((await User.findById(ids.provider))?.providerProfile).toMatchObject({ verified: false, verificationStatus: 'NEEDS_INFO' });
    expect(await VerificationEvent.countDocuments({ action: { $in: ['profile_changed', 'more_info'] } })).toBe(1);
  });
  it('returns bounded JSON parser errors without echoing uploaded bodies', async () => {
    const malformed = await request(app).post('/api/provider-verification/documents').set('Content-Type', 'application/json').send('{"synthetic-private-evidence":');
    expect(malformed.status).toBe(400); expect(malformed.body.message).toBe('Invalid request body.'); expect(JSON.stringify(malformed.body)).not.toContain('synthetic-private-evidence');
    const large = await request(app).post('/api/provider-verification/documents').set('Content-Type', 'application/json').send(JSON.stringify({ content: 'x'.repeat(6 * 1024 * 1024) })); expect(large.status).toBe(413); expect(large.body.message).toBe('Request body is too large.');
  });
});
