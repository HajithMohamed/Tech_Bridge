import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { demoAdminEmail, seedDemoAdmin, validateDemoSeedConfiguration } from '../../src/services/demoSeed';

const valid = {
  NODE_ENV: 'development', ENABLE_DEMO_SEED: 'true',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/techbridge_demo',
  DEMO_ADMIN_PASSWORD: 'Synthetic-Unit-Password-Only!',
};
describe('demo seed configuration', () => {
  it('accepts an explicitly enabled dedicated local demo configuration', () => {
    expect(validateDemoSeedConfiguration(valid).uri).toBe(valid.MONGODB_URI);
    expect(demoAdminEmail).toBe('admin@demo.techbridge.test');
  });
  it.each(['production', 'staging', '', undefined])('rejects unsafe or missing environment %s before connecting', async (mode) => {
    const connect = vi.spyOn(mongoose, 'createConnection');
    await expect(seedDemoAdmin({ ...valid, NODE_ENV: mode })).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(['false', '', undefined])('requires explicit opt-in (%s)', (enabled) => {
    expect(() => validateDemoSeedConfiguration({ ...valid, ENABLE_DEMO_SEED: enabled })).toThrow();
  });
  it.each([
    'mongodb://db.example.test/techbridge_demo',
    'mongodb+srv://db.example.test/techbridge_demo',
    'mongodb://127.0.0.1:27017/techbridge',
    'mongodb://127.0.0.1:27017/production',
    'mongodb://name:private-value@127.0.0.1/techbridge_demo',
    'mongodb://127.0.0.1/techbridge_demo?proxyHost=remote.example.test',
    'mongodb://127.0.0.1/techbridge_demo?directConnection=false',
    'mongodb://127.0.0.1/techbridge_demo?directConnection=true&directConnection=false',
    'not-a-uri', '',
  ])('rejects remote, credential-bearing, ordinary, or invalid database targets', (uri) => {
    try { validateDemoSeedConfiguration({ ...valid, MONGODB_URI: uri }); throw new Error('Unexpected acceptance'); }
    catch (error) {
      expect(String(error)).not.toContain('private-value');
      expect(String(error)).not.toContain('Unexpected acceptance');
      if (uri) expect(String(error)).not.toContain(uri);
    }
  });
  it('accepts local replica-set connection options', () => {
    expect(() => validateDemoSeedConfiguration({ ...valid, MONGODB_URI: valid.MONGODB_URI + '?replicaSet=local_demo&directConnection=true' })).not.toThrow();
  });
  it.each([undefined, '', 'too-short', 'x'.repeat(73), '界'.repeat(25), 'line-break-password\nsecret'])('requires a supplied bcrypt-compatible password', (password) => {
    expect(() => validateDemoSeedConfiguration({ ...valid, DEMO_ADMIN_PASSWORD: password })).toThrow('DEMO_ADMIN_PASSWORD');
  });
  it('allows only namespaced test databases in test mode', () => {
    expect(() => validateDemoSeedConfiguration({ ...valid, NODE_ENV: 'test' })).toThrow();
    expect(() => validateDemoSeedConfiguration({ ...valid, NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1:27099/techbridge_test_0123456789abcdef0123456789abcdef' })).not.toThrow();
  });
});
