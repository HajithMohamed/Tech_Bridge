import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { adminFixture, ids, providerFixture, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase(); const student = generateToken(String(ids.student), 'student'); const provider = generateToken(String(ids.provider), 'provider');
const profile = { isDiscoverable: true, displayName: 'Campus Studio', availability: 'available', platforms: [{ platform: 'instagram', handle: '@campus', profileUrl: 'https://www.instagram.com/campus/', followerCount: 0 }], niches: ['Campus life'], contentTypes: ['Video'], compensationPreference: ['paid'], sampleWorkLinks: [] };
const save = (values: object = profile) => request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send(values);
const browse = (query: Record<string, unknown> = {}) => request(app).get('/api/creators').query(query).auth(provider, { type: 'bearer' });
const detail = (id = String(ids.student)) => request(app).get(`/api/creators/${id}`).auth(provider, { type: 'bearer' });
const visibility = (body: object) => request(app).patch('/api/creators/profile/visibility').auth(student, { type: 'bearer' }).send(body);
beforeAll(() => database.start()); beforeEach(async () => { await database.clear(); await User.create([studentFixture(), providerFixture(), adminFixture()]); }); afterAll(() => database.stop());
describe('creator profile API', () => {
  it('requires explicit opt-in and allows only verified providers to discover creators', async () => {
    expect((await request(app).get('/api/creators').auth(provider, { type: 'bearer' })).body.data.total).toBe(0); expect((await save()).status).toBe(200);
    expect((await request(app).get('/api/creators')).status).toBe(401); expect((await request(app).get('/api/creators').auth(student, { type: 'bearer' })).status).toBe(403);
    const results = await request(app).get('/api/creators').auth(provider, { type: 'bearer' }); expect(results.status).toBe(200); expect(results.body.data.total).toBe(1); expect(results.body.data.creators[0].fullName).toBe('Campus Studio'); expect(results.body.data.creators[0]).not.toHaveProperty('email');
    await User.updateOne({ _id: ids.provider }, { 'providerProfile.verificationStatus': 'PENDING' }); expect((await request(app).get('/api/creators').auth(provider, { type: 'bearer' })).status).toBe(403);
  });
  it('hides discovery and direct profile access after withdrawal', async () => {
    await save(); expect((await save({ ...profile, isDiscoverable: false })).status).toBe(200); expect((await request(app).get(`/api/creators/${ids.student}`).auth(provider, { type: 'bearer' })).status).toBe(404); expect((await request(app).get('/api/creators').auth(provider, { type: 'bearer' })).body.data.total).toBe(0);
  });
  it('filters the public alias literally and validates filters and page boundaries', async () => {
    await save(); const q = (value: string) => request(app).get('/api/creators').query({ q: value }).auth(provider, { type: 'bearer' }); expect((await q('Campus Studio')).body.data.total).toBe(1); expect((await q('Synthetic Student')).body.data.total).toBe(0); expect((await q('.*')).body.data.total).toBe(0);
    expect((await request(app).get('/api/creators?page=0').auth(provider, { type: 'bearer' })).status).toBe(400); expect((await request(app).get('/api/creators?platform=unknown').auth(provider, { type: 'bearer' })).status).toBe(400);
  });
  it('rejects impersonating social links and unauthorized profile edits', async () => {
    expect((await save({ ...profile, platforms: [{ ...profile.platforms[0], profileUrl: 'https://instagram.com.evil.test/campus' }] })).status).toBe(400); expect((await request(app).put('/api/creators/profile').auth(provider, { type: 'bearer' }).send(profile)).status).toBe(403); expect((await User.findById(ids.student))?.studentProfile?.creatorProfile?.isDiscoverable).not.toBe(true);
  });
});

describe('creator consent, ownership and data integrity', () => {
  it('supports creating a private draft, updating it, and explicit discovery consent', async () => {
    const draft = { isDiscoverable: false, platforms: [], niches: [], contentTypes: [], compensationPreference: [] };
    const created = await save(draft); expect(created.status).toBe(200); expect(created.body.data.user.studentProfile.creatorProfile.revision).toBe(1); expect((await browse()).body.data.total).toBe(0);
    expect((await visibility({ isDiscoverable: true })).status).toBe(400);
    const updated = await save({ ...profile, displayName: 'Updated Studio' }); expect(updated.status).toBe(200); expect(updated.body.data.user.studentProfile.creatorProfile.revision).toBe(2);
    expect((await detail()).body.data.creator.fullName).toBe('Updated Studio');
  });
  it('withdraws consent without the full form, keeps portfolio data, and allows valid re-enabling', async () => {
    await save(); const hidden = await visibility({ isDiscoverable: false }); expect(hidden.status).toBe(200); expect(hidden.body.data.user.studentProfile.creatorProfile.platforms).toHaveLength(1);
    expect((await detail()).status).toBe(404); expect((await browse()).body.data.total).toBe(0);
    expect((await request(app).get('/api/auth/me').auth(student, { type: 'bearer' })).body.data.user.studentProfile.creatorProfile.isDiscoverable).toBe(false);
    expect((await visibility({ isDiscoverable: true })).status).toBe(200); expect((await detail()).status).toBe(200);
  });
  it('allows withdrawal of an incomplete legacy profile without forcing new fields', async () => {
    await User.collection.updateOne({ _id: ids.student }, { $set: { 'studentProfile.creatorProfile': { isDiscoverable: true } } });
    expect((await visibility({ isDiscoverable: false })).status).toBe(200); expect((await detail()).status).toBe(404); expect((await visibility({ isDiscoverable: true })).status).toBe(400);
  });
  it('cannot change another account or elevate a role through either update endpoint', async () => {
    await User.create(studentFixture({ _id: ids.outsider, email: 'outsider@example.test' }));
    const attack = { ...profile, _id: String(ids.outsider), userId: String(ids.outsider), role: 'admin', institution: 'Spoofed institution', verificationStatus: 'verified' };
    expect((await request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send(attack)).status).toBe(200);
    expect((await visibility({ isDiscoverable: false, userId: String(ids.outsider) })).status).toBe(200);
    const victim = await User.findById(ids.outsider); expect(victim?.studentProfile?.creatorProfile?.isDiscoverable).not.toBe(true);
    const owner = await User.findById(ids.student); expect(owner?.role).toBe('student'); expect(owner?.studentProfile?.institution).toBe('Test University');
  });
  it('rejects anonymous, administrator and provider profile mutations', async () => {
    expect((await request(app).put('/api/creators/profile').send(profile)).status).toBe(401);
    expect((await request(app).patch('/api/creators/profile/visibility').send({ isDiscoverable: false })).status).toBe(401);
    for (const [id, role] of [[ids.admin, 'admin'], [ids.provider, 'provider']] as const) {
      const token = generateToken(String(id), role);
      expect((await request(app).put('/api/creators/profile').auth(token, { type: 'bearer' }).send(profile)).status).toBe(403);
      expect((await request(app).patch('/api/creators/profile/visibility').auth(token, { type: 'bearer' }).send({ isDiscoverable: false })).status).toBe(403);
    }
  });
  it('does not let ordinary account editing or registration opt users into discovery', async () => {
    const response = await request(app).post('/api/auth/register').send({ fullName: 'New Student', email: 'new@example.test', password: testPassword, confirmPassword: testPassword, role: 'student', studentProfile: { ...studentFixture().studentProfile, creatorProfile: profile } });
    expect(response.status).toBe(201); expect(response.body.data.user.studentProfile.creatorProfile.isDiscoverable).not.toBe(true);
    await save();
    const update = await request(app).put('/api/auth/student-profile').auth(student, { type: 'bearer' }).send({ ...studentFixture().studentProfile, creatorProfile: { ...profile, isDiscoverable: false } });
    expect(update.status).toBe(200); expect((await User.findById(ids.student))?.studentProfile?.creatorProfile?.isDiscoverable).toBe(true);
  });
  it('makes revision-aware concurrent updates conflict instead of overwriting consent', async () => {
    const created = await save(); const revision = created.body.data.user.studentProfile.creatorProfile.revision;
    const responses = await Promise.all([visibility({ isDiscoverable: false, revision }), request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send({ ...profile, displayName: 'Concurrent Edit', revision })]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const latest = (await User.findById(ids.student))?.studentProfile?.creatorProfile; expect(latest?.revision).toBe(revision + 1);
    // A completed withdrawal cannot be undone with the stale editor's revision.
    const hidden = await visibility({ isDiscoverable: false }); expect(hidden.status).toBe(200);
    const stale = await request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send({ ...profile, revision }); expect(stale.status).toBe(409); expect((await detail()).status).toBe(404);
  });
  it('validates visibility and revision values without partial database writes', async () => {
    await save();
    for (const body of [{}, { isDiscoverable: 'false' }, { isDiscoverable: false, revision: -1 }, { isDiscoverable: false, revision: '1' }]) expect((await visibility(body)).status).toBe(400);
    expect((await detail()).status).toBe(200);
  });
  it('preserves a concurrent consent withdrawal while updating academic details', async () => {
    await save(); const responses = await Promise.all([
      visibility({ isDiscoverable: false }),
      request(app).put('/api/auth/student-profile').auth(student, { type: 'bearer' }).send({ ...studentFixture().studentProfile, institution: 'Updated University', creatorProfile: profile }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const owner = await User.findById(ids.student); expect(owner?.studentProfile?.institution).toBe('Updated University'); expect(owner?.studentProfile?.creatorProfile?.isDiscoverable).toBe(false); expect((await detail()).status).toBe(404);
  });
});

describe('creator discovery privacy and filters', () => {
  it('projects only public information and labels all audience metrics without trusting supplied verification', async () => {
    await request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send({ ...profile, profileImageUrl: 'https://images.example.test/avatar.png', verificationStatus: 'verified', metricsSource: 'independent' });
    await User.collection.updateOne({ _id: ids.student }, { $set: { 'studentProfile.creatorProfile.internalNotes': 'private-note', 'studentProfile.creatorProfile.verificationStatus': 'verified' } });
    const response = await detail(); expect(response.status).toBe(200); const creator = response.body.data.creator; const serialized = JSON.stringify(creator);
    expect(creator.studentProfile.creatorProfile).toMatchObject({ metricsSource: 'self_reported', verificationStatus: 'unverified', profileImageUrl: 'https://images.example.test/avatar.png', platforms: [{ followerCount: 0 }] });
    for (const value of ['email', 'password', 'degree', 'skills', 'tokenVersion', 'private-note', 'Test University', 'Synthetic Student', 'revision']) expect(serialized).not.toContain(value);
    expect(response.headers['cache-control']).toBe('no-store'); expect((await browse()).body.data.creators[0]).toEqual(creator);
  });
  it('shares institution only with separate opt-in and removes it when the setting is omitted', async () => {
    expect((await request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send({ ...profile, showInstitution: true })).status).toBe(200);
    expect((await detail()).body.data.creator.studentProfile).toMatchObject({ institution: 'Test University', institutionSource: 'self_reported' });
    await save(); expect((await detail()).body.data.creator.studentProfile).not.toHaveProperty('institution');
  });
  it('never returns hidden, suspended or nonexistent creators, including direct IDs', async () => {
    await save(); await User.updateOne({ _id: ids.student }, { accountStatus: 'suspended' }); expect((await browse()).body.data.total).toBe(0);
    const hidden = await detail(); const missing = await detail(String(ids.outsider)); expect(hidden.status).toBe(404); expect(missing.status).toBe(404); expect(hidden.body).toEqual(missing.body);
    expect((await save()).status).toBe(403); expect((await visibility({ isDiscoverable: false })).status).toBe(403);
  });
  it('rejects administrator and suspended/unverified organization discovery', async () => {
    await save(); expect((await request(app).get('/api/creators').auth(generateToken(String(ids.admin), 'admin'), { type: 'bearer' })).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'suspended' }); expect((await browse()).status).toBe(403); expect((await detail()).status).toBe(403);
    await User.updateOne({ _id: ids.provider }, { accountStatus: 'active', 'providerProfile.verified': false }); expect((await browse()).status).toBe(403); expect((await detail()).status).toBe(403);
  });
  it('combines platform, niche, content, compensation and availability filters', async () => {
    await save();
    expect((await browse({ platform: 'instagram', niche: 'campus', contentType: 'video', compensationPreference: 'paid', availability: 'available' })).body.data.total).toBe(1);
    for (const query of [{ platform: 'youtube' }, { niche: 'engineering' }, { contentType: 'photography' }, { compensationPreference: 'affiliate' }, { availability: 'busy' }]) expect((await browse(query)).body.data.total).toBe(0);
    await User.collection.updateOne({ _id: ids.student }, { $unset: { 'studentProfile.creatorProfile.availability': '' } }); expect((await browse({ availability: 'available' })).body.data.total).toBe(1);
  });
  it('paginates duplicate display names deterministically without leaks or duplicates', async () => {
    await save(); await User.create(studentFixture({ _id: ids.outsider, email: 'outsider@example.test', studentProfile: { ...studentFixture().studentProfile, creatorProfile: profile } }));
    const first = (await browse({ page: '1', limit: '1' })).body.data; const second = (await browse({ page: '2', limit: '1' })).body.data;
    expect(first).toMatchObject({ page: 1, limit: 1, total: 2, pages: 2 }); expect(second.creators).toHaveLength(1); expect(first.creators[0]._id).not.toBe(second.creators[0]._id);
    expect((await browse({ page: '1', limit: '1' })).body.data.creators[0]._id).toBe(first.creators[0]._id); expect((await browse({ page: '3', limit: '1' })).body.data.creators).toEqual([]);
  });
  it('rejects malformed IDs, oversized filters and Mongo-style injected query structures', async () => {
    await save(); expect((await detail('invalid')).status).toBe(400);
    for (const query of [{ q: 'x'.repeat(81) }, { page: '10001' }, { limit: '25' }, { availability: 'unknown' }, { compensationPreference: 'unknown' }, { q: ['a', 'b'] }]) expect((await browse(query)).status).toBe(400);
    expect((await request(app).get('/api/creators?q%5B%24ne%5D=x').auth(provider, { type: 'bearer' })).body.data.total).toBe(1); // Express simple query parser does not interpret Mongo operators.
  });
  it('reports database discovery failures without revealing internal details', async () => {
    vi.spyOn(User, 'countDocuments').mockRejectedValueOnce(new Error('synthetic-private-db-detail'));
    const response = await browse(); expect(response.status).toBe(503); expect(response.body.success).toBe(false); expect(JSON.stringify(response.body)).not.toContain('synthetic-private-db-detail');
  });
});
