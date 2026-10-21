import { execFile } from 'node:child_process';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import User from '../../src/models/User';
import AuditLog from '../../src/models/AuditLog';
import { createDevelopmentAdmin } from '../../src/services/adminBootstrap';
import { TestDatabase } from '../support/database';
import { studentFixture } from '../support/fixtures';

const database = new TestDatabase(); const app = createApp(); const run = promisify(execFile);
const password = 'Synthetic-Bootstrap-Password-Only!';
const environment = () => ({
  NODE_ENV: 'test', ADMIN_CREATE_ENABLED: 'true', MONGODB_URI: database.getUri(),
  ADMIN_CREATE_CONFIRM_DATABASE: new URL(database.getUri()).pathname.slice(1),
  ADMIN_CREATE_EMAIL: 'local-admin@example.test', ADMIN_CREATE_NAME: 'Local Administrator', ADMIN_CREATE_PASSWORD: password,
});
beforeAll(() => database.start()); beforeEach(() => database.clear()); afterAll(() => database.stop());

describe('offline admin creation using isolated real MongoDB', () => {
  it('creates a bcrypt-protected admin and transactional audit, then supports login and admin API access', async () => {
    expect(await createDevelopmentAdmin(environment())).toEqual({ created: true });
    const admin = await User.findOne({ email: environment().ADMIN_CREATE_EMAIL }).select('+password');
    expect(admin?.role).toBe('admin'); expect(admin?.accountStatus).toBe('active');
    expect(admin?.password).not.toBe(password); expect(await admin!.comparePassword(password)).toBe(true);
    const audit = await AuditLog.findOne({ action: 'admin_created_local_cli' });
    expect(audit?.targetId).toEqual(admin?._id); expect(audit?.adminId).toEqual(admin?._id);
    expect(JSON.stringify(audit)).not.toContain(password);
    const login = await request(app).post('/api/auth/login').send({ email: environment().ADMIN_CREATE_EMAIL, password });
    expect(login.status).toBe(200); expect(login.body.data.user.role).toBe('admin');
    expect(login.body.data.user).not.toHaveProperty('password');
    expect((await request(app).get('/api/admin/users').auth(login.body.data.token, { type: 'bearer' })).status).toBe(200);
  });
  it('does not overwrite an existing admin, password or suspended status', async () => {
    await createDevelopmentAdmin(environment());
    await User.updateOne({ email: environment().ADMIN_CREATE_EMAIL }, { accountStatus: 'suspended' });
    const before = await User.findOne({ email: environment().ADMIN_CREATE_EMAIL }).select('+password').lean();
    expect(await createDevelopmentAdmin({ ...environment(), ADMIN_CREATE_PASSWORD: 'Different-Synthetic-Password-Only!' })).toEqual({ created: false });
    expect(await User.findOne({ email: environment().ADMIN_CREATE_EMAIL }).select('+password').lean()).toEqual(before);
    expect(await AuditLog.countDocuments()).toBe(1);
  });
  it('cannot promote an existing student or alter unrelated records', async () => {
    await User.create(studentFixture({ email: environment().ADMIN_CREATE_EMAIL }));
    const before = await User.find().select('+password').lean();
    await expect(createDevelopmentAdmin(environment())).rejects.toThrow('another role');
    expect(await User.find().select('+password').lean()).toEqual(before);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
  it('creates only one account/audit under concurrent commands and retains the winning password', async () => {
    const other = 'Different-Concurrent-Password-Only!';
    const results = await Promise.all([createDevelopmentAdmin(environment()), createDevelopmentAdmin({ ...environment(), ADMIN_CREATE_PASSWORD: other })]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await User.countDocuments()).toBe(1); expect(await AuditLog.countDocuments()).toBe(1);
    const admin = await User.findOne().select('+password');
    expect(await admin!.comparePassword(results[0].created ? password : other)).toBe(true);
    expect(await admin!.comparePassword(results[0].created ? other : password)).toBe(false);
  });
  it('rolls account creation back if the audit insert fails', async () => {
    const collectionName = AuditLog.collection.collectionName;
    const originalInsert = mongoose.mongo.Collection.prototype.insertOne;
    const insert = vi.spyOn(mongoose.mongo.Collection.prototype, 'insertOne').mockImplementation(function (this: mongoose.mongo.Collection, ...args) {
      if (this.collectionName === collectionName) return Promise.reject(new Error('Synthetic audit storage failure')) as ReturnType<typeof this.insertOne>;
      return originalInsert.apply(this, args);
    });
    try {
      await expect(createDevelopmentAdmin(environment())).rejects.toThrow('Synthetic audit storage failure');
      expect(await User.countDocuments()).toBe(0); expect(await AuditLog.countDocuments()).toBe(0);
    } finally { insert.mockRestore(); }
  });
  it('refuses creation when the database lacks its unique email constraint', async () => {
    const indexes = vi.spyOn(mongoose.mongo.Collection.prototype, 'indexes').mockResolvedValue([]);
    try {
      await expect(createDevelopmentAdmin(environment())).rejects.toThrow('unique email index is required');
      expect(await User.countDocuments()).toBe(0); expect(await AuditLog.countDocuments()).toBe(0);
    } finally { indexes.mockRestore(); }
  });
  it('executes the real CLI, exits cleanly and never prints supplied credentials or the database URI', async () => {
    const result = await run(process.execPath, ['--import', 'tsx', 'src/createAdmin.ts'], {
      cwd: resolve(__dirname, '../..'), env: { ...process.env, ...environment() }, timeout: 15_000,
    });
    expect(result.stdout).toContain('Administrator created with an audit entry'); expect(result.stderr).toBe('');
    expect(result.stdout + result.stderr).not.toContain(password); expect(result.stdout + result.stderr).not.toContain(database.getUri());
    expect(await User.countDocuments()).toBe(1); expect(await AuditLog.countDocuments()).toBe(1);
  });
  it('refuses production CLI execution without modifying accounts or leaking input', async () => {
    await expect(run(process.execPath, ['--import', 'tsx', 'src/createAdmin.ts'], {
      cwd: resolve(__dirname, '../..'), env: { ...process.env, ...environment(), NODE_ENV: 'production' }, timeout: 15_000,
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('Admin creation requires') });
    expect(await User.countDocuments()).toBe(0);
  });
  it('does not allow .env.admin to redirect the normal database', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'techbridge-admin-cli-'));
    try {
      await writeFile(resolve(directory, '.env.admin'), 'MONGODB_URI=mongodb://private:password@other.example.test/wrong_database');
      await expect(run(process.execPath, ['--import', pathToFileURL(resolve(__dirname, '../../node_modules/tsx/dist/loader.mjs')).href, resolve(__dirname, '../../src/createAdmin.ts')], {
        cwd: directory, env: { ...process.env, ...environment() }, timeout: 15_000,
      })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('Do not put MONGODB_URI in .env.admin') });
      expect(await User.countDocuments()).toBe(0);
    } finally { await unlink(resolve(directory, '.env.admin')); await rmdir(directory); }
  });
});
