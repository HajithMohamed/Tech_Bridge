import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { securityConfiguration } from '../../src/config/security';
import { bearerToken } from '../../src/utils/bearer';
import { generateToken, generateVerificationToken, verifyToken } from '../../src/utils/jwt';

const production = { NODE_ENV: 'production', JWT_SECRET: 'Synthetic-private-signing-material-for-tests-only-42!', CORS_ORIGINS: 'https://app.example.test' };
const credential = 'eyJhbGci.eyJzdWIi.signature';
describe('deployment security configuration', () => {
  it('preserves the existing local defaults and deduplicates explicit origins', () => {
    expect(securityConfiguration({ NODE_ENV: 'test' }).allowedOrigins).toEqual(['http://localhost:5173', 'http://localhost:3000']);
    expect(securityConfiguration({ NODE_ENV: 'development', CORS_ORIGINS: 'https://app.example.test/, https://app.example.test' }).allowedOrigins).toEqual(['https://app.example.test']);
  });
  it('accepts explicitly configured production origins without printing secrets', () => expect(securityConfiguration(production).allowedOrigins).toEqual(['https://app.example.test']));
  it.each([{}, { JWT_SECRET: '' }, { JWT_SECRET: 'short' }, { JWT_SECRET: ' '.repeat(40) }, { JWT_SECRET: 'changeme'.repeat(8) }, { CORS_ORIGINS: '' }, { NODE_ENV: 'unknown' }])('rejects incomplete/unsafe production configuration %j', (override) => {
    const environment = Object.keys(override).length ? { ...production, ...override } : { NODE_ENV: 'production' };
    expect(() => securityConfiguration(environment)).toThrow();
  });
  it.each(['*', 'https://*.example.test', 'http://app.example.test', 'https://user:secret@app.example.test', 'https://app.example.test/private', 'https://app.example.test/?secret=private', 'https://app.example.test/#private', 'file:///private', 'https://a.test,,https://b.test', Array.from({ length: 11 }, (_, i) => `https://app${i}.test`).join(',')])('rejects unsafe allowlist without reflecting its value', (CORS_ORIGINS) => {
    try { securityConfiguration({ ...production, CORS_ORIGINS }); throw new Error('Expected rejection'); } catch (error) { expect(String(error)).not.toContain(CORS_ORIGINS); expect(error).not.toHaveProperty('message', 'Expected rejection'); }
  });
});
describe('bounded bearer credentials', () => {
  it.each([`Bearer ${credential}`, `bearer ${credential}`, `  BEARER\t${credential}  `])('accepts a single valid scheme %s', (header) => expect(bearerToken(header)).toBe(credential));
  it.each([undefined, null, [], 'Bearer', 'Bearer invalid', `BearerExtra ${credential}`, `Basic ${credential}`, `Bearer ${credential} trailing`, `Bearer ${credential},${credential}`, 'Bearer ' + 'x'.repeat(4096)])('rejects malformed authorization %j', (header) => expect(bearerToken(header)).toBeNull());
});
describe('session signature and claim policy', () => {
  const payload = { userId: '000000000000000000000001', role: 'student', version: 0 };
  const sign = (values = {}, options: jwt.SignOptions = { expiresIn: '1m' }) => jwt.sign({ ...payload, ...values }, process.env.JWT_SECRET!, options);
  it('preserves issued full/restricted sessions and legacy omitted versions', () => {
    expect(verifyToken(generateToken(payload.userId, 'student')).role).toBe('student');
    expect(verifyToken(generateVerificationToken(payload.userId)).scope).toBe('verification');
    expect(verifyToken(sign({ version: undefined })).version).toBeUndefined();
  });
  it('rejects a valid signature using an unsupported algorithm and non-expiring tokens', () => {
    expect(() => verifyToken(sign({}, { algorithm: 'HS384', expiresIn: '1m' }))).toThrow();
    expect(() => verifyToken(sign({}, {}))).toThrow();
  });
  it.each([{ userId: '' }, { userId: {} }, { userId: 'x'.repeat(129) }, { role: 'owner' }, { version: -1 }, { version: 1.5 }, { version: '0' }, { scope: 'admin' }, { scope: 'verification', role: 'student' }])('rejects malformed signed claims %j', (values) => expect(() => verifyToken(sign(values))).toThrow());
});
describe('patched proxy subnet behavior', () => {
  const proxyAddress = require('proxy-addr');
  it('does not trust arbitrary IPv4 clients through a short mapped-IPv6 prefix', () => expect(proxyAddress.compile('::ffff:10.0.0.0/8')('203.0.113.7', 0)).toBe(false));
  it('retains ordinary explicit IPv4 subnet handling', () => {
    const trusted = proxyAddress.compile('10.0.0.0/8'); expect(trusted('10.2.3.4', 0)).toBe(true); expect(trusted('203.0.113.7', 0)).toBe(false);
  });
});
