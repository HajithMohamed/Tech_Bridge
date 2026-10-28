import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuthChallenge from '../../src/models/AuthChallenge';
import { challengeHash } from '../../src/services/authChallenges';
import { generateToken } from '../../src/utils/jwt';
import { TestDatabase } from '../support/database';
import { ids, studentFixture, testPassword } from '../support/fixtures';

const app = createApp(); const database = new TestDatabase(); const token = 'a'.repeat(43); const newPassword = 'Synthetic-Replacement-Password-42!';
const login = () => request(app).post('/api/auth/login').send({ email: 'student@example.test', password: testPassword });
const reset = () => request(app).post('/api/auth/reset-password').send({ token, password: newPassword, confirmPassword: newPassword });
async function challenge(purpose = 'password_reset', changes = {}) { return AuthChallenge.create({ userId: ids.student, email: 'student@example.test', purpose, tokenHash: challengeHash(token), expiresAt: new Date(Date.now() + 60_000), ...changes }); }
beforeAll(() => database.start()); beforeEach(async () => { await database.clear(); await User.create(studentFixture()); }); afterAll(() => database.stop());
describe('draft authentication recovery against isolated MongoDB', () => {
  it('preserves existing account login but gates newly unverified accounts', async () => {
    expect((await login()).status).toBe(200); await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); const blocked = await login(); expect(blocked.status).toBe(403); expect(blocked.body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
  });
  it('verifies a matching email once and then allows login', async () => {
    await User.updateOne({ _id: ids.student }, { requiresEmailVerification: true }); await challenge('verify_email');
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200); expect((await login()).status).toBe(200); expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
  });
  it('resets a hashed password and revokes the prior token version', async () => {
    const oldSession = generateToken(String(ids.student), 'student'); await challenge(); expect((await reset()).status).toBe(200);
    expect((await login()).status).toBe(401); expect((await request(app).post('/api/auth/login').send({ email: 'student@example.test', password: newPassword })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').auth(oldSession, { type: 'bearer' })).status).toBe(401); expect((await reset()).status).toBe(400); expect((await User.findById(ids.student).select('+password'))?.password).not.toBe(newPassword);
  });
  it('consumes only one competing reset and invalidates sibling links', async () => {
    await challenge(); await AuthChallenge.create({ userId: ids.student, email: 'student@example.test', purpose: 'password_reset', tokenHash: challengeHash('b'.repeat(43)), expiresAt: new Date(Date.now() + 60_000) });
    const responses = await Promise.all([reset(), reset()]); expect(responses.map((row) => row.status).sort()).toEqual([200, 400]); expect(await AuthChallenge.countDocuments({ consumedAt: { $exists: false } })).toBe(0);
  });
  it('rejects expired links, changed account email and short replacement passwords', async () => {
    await challenge('password_reset', { expiresAt: new Date(Date.now() - 1000) }); expect((await reset()).status).toBe(400); await AuthChallenge.deleteMany({});
    await challenge('password_reset', { email: 'old-address@example.test' }); expect((await reset()).status).toBe(400); expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'short', confirmPassword: 'short' })).status).toBe(400); expect((await login()).status).toBe(200);
  });
  it('keeps forgot-password responses generic and removes undelivered challenges', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'student@example.test' }); const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.test' }); expect(known.status).toBe(202); expect(unknown.status).toBe(202); expect(known.body).toEqual(unknown.body); expect(await AuthChallenge.countDocuments()).toBe(0);
  });
  it('enforces the shared per-account login limit', async () => {
    for (let i = 0; i < 10; i++) expect((await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password: 'wrong' })).status).toBe(401);
    const limited = await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password: 'wrong' }); expect(limited.status).toBe(429); expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
