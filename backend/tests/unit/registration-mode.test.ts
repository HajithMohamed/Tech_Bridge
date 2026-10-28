import { describe, expect, it } from 'vitest';
import { registrationMode } from '../../src/config/registration';
import { securityConfiguration } from '../../src/config/security';

describe('server-owned registration rollout configuration', () => {
  it.each(['development', 'test', 'production'])('preserves the established contract by default in %s', NODE_ENV => {
    expect(registrationMode({ NODE_ENV })).toBe('legacy');
    expect(registrationMode({ NODE_ENV, AUTH_REGISTRATION_MODE: 'legacy' })).toBe('legacy');
  });
  it.each(['', 'true', 'false', 'EMAIL_VERIFICATION', 'legacy, email_verification', 'private-invalid-value'])('rejects invalid mode without reflecting it: %s', AUTH_REGISTRATION_MODE => {
    try { registrationMode({ NODE_ENV: 'test', AUTH_REGISTRATION_MODE }); throw new Error('Expected rejection'); }
    catch (error) { expect((error as Error).message).toBe('AUTH_REGISTRATION_MODE must be legacy or email_verification.'); }
  });
  it.each(['development', 'test'])('allows explicitly configured local verification in %s', NODE_ENV => {
    expect(registrationMode({ NODE_ENV, AUTH_REGISTRATION_MODE: 'email_verification', MAIL_DELIVERY_MODE: 'local', PUBLIC_APP_URL: 'http://localhost:5173' })).toBe('email_verification');
  });
  it('rejects verification mode without a deliverable adapter or trusted application origin', () => {
    expect(() => registrationMode({ NODE_ENV: 'test', AUTH_REGISTRATION_MODE: 'email_verification' })).toThrow('delivery adapter');
    expect(() => registrationMode({ NODE_ENV: 'production', AUTH_REGISTRATION_MODE: 'email_verification', MAIL_DELIVERY_MODE: 'local', PUBLIC_APP_URL: 'https://app.example.test' })).toThrow();
    expect(() => registrationMode({ NODE_ENV: 'test', AUTH_REGISTRATION_MODE: 'email_verification', MAIL_DELIVERY_MODE: 'local', PUBLIC_APP_URL: 'https://app.example.test/path' })).toThrow();
  });
  it('integrates mode validation with application startup configuration', () => {
    expect(securityConfiguration({ NODE_ENV: 'test' }).registrationMode).toBe('legacy');
    expect(() => securityConfiguration({ NODE_ENV: 'test', AUTH_REGISTRATION_MODE: 'unknown' })).toThrow('AUTH_REGISTRATION_MODE');
  });
});
