import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import connectDB from '../../src/config/db';
import { createDevelopmentAdmin, validateAdminBootstrap } from '../../src/services/adminBootstrap';
import { databaseErrorMessage } from '../../src/utils/databaseError';

const valid = {
  NODE_ENV: 'development', ADMIN_CREATE_ENABLED: 'true',
  MONGODB_URI: 'mongodb+srv://synthetic:private-value@db.example.test/techbridge_local',
  ADMIN_CREATE_CONFIRM_DATABASE: 'techbridge_local', ADMIN_CREATE_EMAIL: '  Admin@Example.test ',
  ADMIN_CREATE_NAME: 'Local Administrator', ADMIN_CREATE_PASSWORD: 'Synthetic-Unit-Password-Only!',
};

describe('offline administrator creation configuration', () => {
  it('accepts an explicitly confirmed development database and normalizes the identity', () => {
    expect(validateAdminBootstrap(valid)).toMatchObject({ email: 'admin@example.test', fullName: valid.ADMIN_CREATE_NAME });
  });
  it.each(['production', 'staging', '', undefined])('rejects environment %s before opening a connection', async (mode) => {
    const connect = vi.spyOn(mongoose, 'createConnection');
    await expect(createDevelopmentAdmin({ ...valid, NODE_ENV: mode })).rejects.toThrow('Admin creation requires');
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(['false', '', undefined])('requires explicit opt-in (%s)', (enabled) => {
    expect(() => validateAdminBootstrap({ ...valid, ADMIN_CREATE_ENABLED: enabled })).toThrow('Admin creation requires');
  });
  it.each(['', 'other_database', undefined])('requires exact database confirmation (%s)', (database) => {
    expect(() => validateAdminBootstrap({ ...valid, ADMIN_CREATE_CONFIRM_DATABASE: database })).toThrow('exact database name');
  });
  it.each(['', 'not-a-uri', 'https://db.example.test/techbridge_local', 'mongodb://127.0.0.1', 'mongodb://127.0.0.1/', 'mongodb://127.0.0.1/techbridge_local#fragment'])('rejects invalid/implicit targets without revealing input', (uri) => {
    expect(() => validateAdminBootstrap({ ...valid, MONGODB_URI: uri })).toThrow('Set an explicit database');
  });
  it('accepts a multi-host development replica set with an explicit database', () => {
    expect(() => validateAdminBootstrap({ ...valid, MONGODB_URI: 'mongodb://one.example.test:27017,two.example.test:27017/techbridge_local?replicaSet=dev' })).not.toThrow();
  });
  it.each(['invalid', '', 'x'.repeat(255) + '@example.test'])('rejects invalid email', (email) => {
    expect(() => validateAdminBootstrap({ ...valid, ADMIN_CREATE_EMAIL: email })).toThrow('ADMIN_CREATE_EMAIL');
  });
  it.each(['', 'a', 'a'.repeat(101), 'Admin\nName'])('rejects invalid names', (name) => {
    expect(() => validateAdminBootstrap({ ...valid, ADMIN_CREATE_NAME: name })).toThrow('ADMIN_CREATE_NAME');
  });
  it.each(['', 'short', 'x'.repeat(73), '界'.repeat(25), 'Long-Password-With\nLine'])('rejects incompatible passwords', (password) => {
    expect(() => validateAdminBootstrap({ ...valid, ADMIN_CREATE_PASSWORD: password })).toThrow('ADMIN_CREATE_PASSWORD');
  });
  it('requires a disposable loopback target in test mode', () => {
    expect(() => validateAdminBootstrap({ ...valid, NODE_ENV: 'test' })).toThrow('isolated loopback');
    const name = 'techbridge_test_0123456789abcdef0123456789abcdef';
    expect(() => validateAdminBootstrap({ ...valid, NODE_ENV: 'test', MONGODB_URI: `mongodb://127.0.0.1:27017/${name}`, ADMIN_CREATE_CONFIRM_DATABASE: name })).not.toThrow();
  });
});

describe('safe database startup diagnostics', () => {
  it.each([{ code: 18 }, { code: 8000 }, { message: 'bad auth : authentication failed' }])('explains authentication errors without logging driver details', (error) => {
    expect(databaseErrorMessage({ ...error, connectionString: valid.MONGODB_URI })).toContain('MongoDB authentication failed');
    expect(databaseErrorMessage(error)).not.toContain('private-value');
  });
  it('distinguishes malformed connections, network failures and unknown errors', () => {
    expect(databaseErrorMessage({ name: 'MongoParseError', message: valid.MONGODB_URI })).toContain('Invalid MONGODB_URI');
    expect(databaseErrorMessage({ name: 'MongoServerSelectionError', message: valid.MONGODB_URI })).toContain('MongoDB is unreachable');
    for (const error of [undefined, new Error(valid.MONGODB_URI), { message: valid.ADMIN_CREATE_PASSWORD }]) {
      expect(databaseErrorMessage(error)).not.toContain('private-value');
      expect(databaseErrorMessage(error)).not.toContain(valid.ADMIN_CREATE_PASSWORD);
    }
  });
  it('rejects failed startup with a sanitized error rather than exiting or exposing credentials', async () => {
    vi.stubEnv('MONGODB_URI', valid.MONGODB_URI);
    const connect = vi.spyOn(mongoose, 'connect').mockRejectedValue(Object.assign(new Error(valid.MONGODB_URI), { code: 8000 }));
    try {
      await expect(connectDB()).rejects.toThrow('MongoDB authentication failed');
      expect(connect).toHaveBeenCalledWith(valid.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    } finally { vi.unstubAllEnvs(); }
  });
});
