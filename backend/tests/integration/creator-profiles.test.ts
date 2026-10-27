import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { ids, providerFixture, studentFixture } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase(); const student = generateToken(String(ids.student), 'student'); const provider = generateToken(String(ids.provider), 'provider');
const profile = { isDiscoverable: true, displayName: 'Campus Studio', availability: 'available', platforms: [{ platform: 'instagram', handle: '@campus', profileUrl: 'https://www.instagram.com/campus/', followerCount: 0 }], niches: ['Campus life'], contentTypes: ['Video'], compensationPreference: ['paid'], sampleWorkLinks: [] };
const save = (values = profile) => request(app).put('/api/creators/profile').auth(student, { type: 'bearer' }).send(values);
beforeAll(() => database.start()); beforeEach(async () => { await database.clear(); await User.create([studentFixture(), providerFixture()]); }); afterAll(() => database.stop());
describe('draft creator profile API', () => {
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
