import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import { demoAdminEmail, seedDemoAdmin } from '../../src/services/demoSeed';
import { TestDatabase } from '../support/database';
import { providerFixture } from '../support/fixtures';

const database = new TestDatabase();
const app = createApp();
const run = promisify(execFile);
const password = 'Synthetic-Integration-Password-Only!';
const environment = () => ({ NODE_ENV: 'test', ENABLE_DEMO_SEED: 'true', MONGODB_URI: database.getUri(), DEMO_ADMIN_PASSWORD: password });
beforeAll(() => database.start());
beforeEach(() => database.clear());
afterAll(() => database.stop());

describe('safe demo seeding against a real isolated database', () => {
  it('creates only a synthetic administrator with a hashed caller-supplied password', async () => {
    expect(await seedDemoAdmin(environment())).toEqual({ created: true });
    const users = await User.find().select('+password');
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(demoAdminEmail);
    expect(users[0].fullName).toBe('Demo Administrator (Synthetic)');
    expect(users[0].role).toBe('admin');
    expect(users[0].password).not.toBe(password);
    expect(await users[0].comparePassword(password)).toBe(true);
    expect(users[0].providerProfile?.verified).not.toBe(true);
    const login = await request(app).post('/api/auth/login').send({ email: demoAdminEmail, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user).not.toHaveProperty('password');
  });
  it('does not create or alter any real directory or existing provider identity', async () => {
    const provider = await User.create(providerFixture());
    const before = await User.findById(provider._id).lean();
    await seedDemoAdmin(environment());
    expect(await User.findById(provider._id).lean()).toEqual(before);
    expect(await User.countDocuments({ role: 'provider' })).toBe(1);
    expect(await User.countDocuments()).toBe(2);
  });
  it('preserves existing passwords and suspended status on repeat runs', async () => {
    await seedDemoAdmin(environment());
    await User.updateOne({ email: demoAdminEmail }, { accountStatus: 'suspended' });
    const before = await User.findOne({ email: demoAdminEmail }).select('+password').lean();
    expect(await seedDemoAdmin({ ...environment(), DEMO_ADMIN_PASSWORD: 'Different-Synthetic-Password-Only!' })).toEqual({ created: false });
    expect(await User.findOne({ email: demoAdminEmail }).select('+password').lean()).toEqual(before);
  });
  it('cannot promote a pre-existing account using the reserved demo email', async () => {
    await User.create({ fullName: 'Existing Account', email: demoAdminEmail, password, role: 'student' });
    await expect(seedDemoAdmin(environment())).rejects.toThrow('different role');
    expect((await User.findOne({ email: demoAdminEmail }))?.role).toBe('student');
    expect(await User.countDocuments()).toBe(1);
  });
  it('handles concurrent seed requests without duplicate accounts or password replacement', async () => {
    const otherPassword = 'Other-Synthetic-Concurrent-Password!';
    const results = await Promise.all([seedDemoAdmin(environment()), seedDemoAdmin({ ...environment(), DEMO_ADMIN_PASSWORD: otherPassword })]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await User.countDocuments()).toBe(1);
    const admin = await User.findOne({ email: demoAdminEmail }).select('+password');
    expect(await admin!.comparePassword(results[0].created ? password : otherPassword)).toBe(true);
    expect(await admin!.comparePassword(results[0].created ? otherPassword : password)).toBe(false);
  });
  it('executes the real CLI, closes its connection, and does not print credentials or the URI', async () => {
    const result = await run(process.execPath, ['--import', 'tsx', 'src/seed.ts'], {
      cwd: resolve(__dirname, '../..'), env: { ...process.env, ...environment() }, timeout: 10_000,
    });
    expect(result.stdout).toContain('Synthetic demo administrator created');
    expect(result.stderr).toBe('');
    expect(result.stdout + result.stderr).not.toContain(password);
    expect(result.stdout + result.stderr).not.toContain(database.getUri());
    expect(await User.countDocuments()).toBe(1);
  });
  it('rejects a production-mode CLI run without modifying the database or leaking input', async () => {
    let rejected = false;
    try {
      await run(process.execPath, ['--import', 'tsx', 'src/seed.ts'], {
        cwd: resolve(__dirname, '../..'), env: { ...process.env, ...environment(), NODE_ENV: 'production' }, timeout: 10_000,
      });
    } catch (error) {
      rejected = true;
      const failure = error as { code: number; stdout: string; stderr: string };
      expect(failure.code).toBe(1);
      expect(failure.stderr).toContain('requires development/test mode');
      expect(failure.stdout + failure.stderr).not.toContain(password);
      expect(failure.stdout + failure.stderr).not.toContain(database.getUri());
    }
    expect(rejected).toBe(true);
    expect(await User.countDocuments()).toBe(0);
  });
  it('supports the documented env-file loader and refuses the unfilled example before connection', async () => {
    const target = new URL(database.getUri());
    target.pathname = '/techbridge_demo';
    let rejected = false;
    try {
      await run(process.execPath, [resolve(__dirname, '../../node_modules/tsx/dist/cli.mjs'), '--env-file=demo-seed.env.example', 'src/seed.ts'], {
        cwd: resolve(__dirname, '../..'),
        env: { ...process.env, NODE_ENV: 'development', ENABLE_DEMO_SEED: 'true', MONGODB_URI: target.href, DEMO_ADMIN_PASSWORD: '' },
        timeout: 10_000,
      });
    } catch (error) {
      rejected = true;
      const failure = error as { code: number; stdout: string; stderr: string };
      expect(failure.code).toBe(1);
      expect(failure.stderr).toContain('Provide DEMO_ADMIN_PASSWORD');
      expect(failure.stdout + failure.stderr).not.toContain('mongodb://');
    }
    expect(rejected).toBe(true);
    expect(await User.countDocuments()).toBe(0);
  });
});
