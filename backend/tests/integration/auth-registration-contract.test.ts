import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuthChallenge from '../../src/models/AuthChallenge';
import * as delivery from '../../src/services/mailDelivery';
import { challengeHash } from '../../src/services/authChallenges';
import { TestDatabase } from '../support/database';
import { providerFixture, studentFixture, testPassword } from '../support/fixtures';

const database = new TestDatabase();
const signup = (app: ReturnType<typeof createApp>, values: Record<string, unknown> = {}) => request(app).post('/api/auth/register').send({ ...studentFixture(), confirmPassword: testPassword, ...values });
const login = (app: ReturnType<typeof createApp>, email = 'student@example.test') => request(app).post('/api/auth/login').send({ email, password: testPassword });
function verifiedApp() {
  vi.stubEnv('AUTH_REGISTRATION_MODE', 'email_verification'); vi.stubEnv('MAIL_DELIVERY_MODE', 'local'); vi.stubEnv('PUBLIC_APP_URL', 'http://localhost:5173');
  const mail = vi.spyOn(delivery, 'deliverMail').mockResolvedValue();
  return { app: createApp(), mail };
}
beforeAll(() => database.start());
beforeEach(async () => { await database.clear(); vi.stubEnv('AUTH_REGISTRATION_MODE', undefined); vi.stubEnv('MAIL_DELIVERY_MODE', 'disabled'); });
afterEach(() => vi.unstubAllEnvs());
afterAll(() => database.stop());

describe('registration contract compatibility on real MongoDB', () => {
  it('keeps default student registration at 201 with a usable session and no false email-verification claim', async () => {
    const app = createApp(); const result = await signup(app, { requiresEmailVerification: true, emailVerifiedAt: new Date().toISOString() });
    expect(result.status).toBe(201); expect(result.body.data.user).toMatchObject({ role: 'student', email: 'student@example.test' }); expect(result.body.data.user.password).toBeUndefined();
    expect((await request(app).get('/api/auth/me').auth(result.body.data.token, { type: 'bearer' })).status).toBe(200);
    const stored = await User.findOne(); expect(stored?.requiresEmailVerification).toBe(false); expect(stored?.emailVerifiedAt).toBeUndefined(); expect(await AuthChallenge.countDocuments()).toBe(0);
  });
  it('keeps default provider registration at 201 without general access or forged verification fields', async () => {
    const app = createApp(); const result = await signup(app, { ...providerFixture(), requiresEmailVerification: false, emailVerifiedAt: new Date().toISOString() });
    expect(result.status).toBe(201); expect(result.body.data.token).toBeUndefined(); expect(result.body.data.user.providerProfile).toMatchObject({ verified: false, verificationStatus: 'PENDING' });
    expect((await login(app, 'provider@example.test')).status).toBe(403); expect((await User.findOne())?.emailVerifiedAt).toBeUndefined();
  });
  it('keeps duplicate legacy signup as a rejection without changing the account or issuing another token', async () => {
    const app = createApp(); expect((await signup(app)).status).toBe(201); const first = await User.findOne().lean();
    const duplicate = await signup(app, { fullName: 'Forged replacement identity' }); expect(duplicate.status).toBe(400); expect(duplicate.body.data).toBeUndefined(); expect(await User.findOne().lean()).toEqual(first);
  });
  it('serializes legacy duplicate-email races into one created account and one rejection', async () => {
    const app = createApp(); const results = await Promise.all([signup(app), signup(app)]);
    expect(results.map(row => row.status).sort()).toEqual([201, 400]); expect(await User.countDocuments()).toBe(1); expect(await AuthChallenge.countDocuments()).toBe(0);
  });
  it('enables generic 202 only by server configuration, hashes the link, and requires actual verification', async () => {
    const { app, mail } = verifiedApp(); const result = await signup(app, { AUTH_REGISTRATION_MODE: 'legacy', requiresEmailVerification: false, emailVerifiedAt: new Date().toISOString() });
    expect(result.status).toBe(202); expect(result.body.data).toBeUndefined(); expect((await login(app)).body.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    const stored = await User.findOne(); expect(stored?.requiresEmailVerification).toBe(true); expect(stored?.emailVerifiedAt).toBeUndefined();
    expect(mail).toHaveBeenCalledTimes(1); const link = new URL(mail.mock.calls[0][0].text.split('\n').find(line => line.startsWith('http'))!); const token = new URLSearchParams(link.hash.slice(1)).get('token')!;
    expect((await AuthChallenge.findOne())?.tokenHash).toBeUndefined();
    expect((await AuthChallenge.findOne().select('+tokenHash'))?.tokenHash).toBe(challengeHash(token)); expect(JSON.stringify(result.body)).not.toContain(token);
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200); expect((await login(app)).status).toBe(200);
  });
  it('does not disclose existing identities or reset credentials through generic verification-mode registration', async () => {
    const { app } = verifiedApp(); const first = await signup(app); const stored = await User.findOne().select('+password').lean();
    const duplicate = await signup(app, { password: 'Untrusted-Replacement-Password-42!', confirmPassword: 'Untrusted-Replacement-Password-42!', fullName: 'Forged replacement identity' });
    expect(duplicate.status).toBe(202); expect(duplicate.body).toEqual(first.body); expect(await User.findOne().select('+password').lean()).toEqual(stored);
  });
  it('does not bypass an existing email gate after a rollout rollback or duplicate legacy signup', async () => {
    const { app } = verifiedApp(); expect((await signup(app)).status).toBe(202);
    vi.stubEnv('AUTH_REGISTRATION_MODE', 'legacy'); const legacy = createApp();
    const duplicate = await signup(legacy, { requiresEmailVerification: false, emailVerifiedAt: new Date().toISOString() }); expect(duplicate.status).toBe(400); expect(duplicate.body.data).toBeUndefined();
    expect((await login(legacy)).body.code).toBe('EMAIL_VERIFICATION_REQUIRED'); expect((await User.findOne())?.requiresEmailVerification).toBe(true);
  });
  it('captures rollout mode at application startup instead of trusting request input or runtime environment edits', async () => {
    const { app } = verifiedApp(); vi.stubEnv('AUTH_REGISTRATION_MODE', 'legacy');
    expect((await signup(app, { registrationMode: 'legacy', requiresEmailVerification: false })).status).toBe(202);
    expect((await User.findOne())?.requiresEmailVerification).toBe(true);
  });
  it('still requires separate provider approval after email verification', async () => {
    const { app, mail } = verifiedApp(); const result = await signup(app, providerFixture()); expect(result.status).toBe(202);
    const link = new URL(mail.mock.calls[0][0].text.split('\n').find(line => line.startsWith('http'))!); const token = new URLSearchParams(link.hash.slice(1)).get('token');
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);
    const resultLogin = await login(app, 'provider@example.test'); expect(resultLogin.status).toBe(403); expect(resultLogin.body.code).not.toBe('EMAIL_VERIFICATION_REQUIRED');
    expect((await User.findOne())?.providerProfile?.verificationStatus).toBe('PENDING');
  });
});
