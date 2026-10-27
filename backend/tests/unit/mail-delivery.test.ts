import { describe, expect, it } from 'vitest';
import { mailDeliveryMode, publicAppUrl } from '../../src/services/mailDelivery';

describe('local mail support configuration', () => {
  it('uses the local application origin in development only', () => {
    expect(publicAppUrl({ NODE_ENV: 'development' })).toBe('http://localhost:5173');
    expect(() => publicAppUrl({ NODE_ENV: 'production' })).toThrow();
    expect(publicAppUrl({ NODE_ENV: 'production', PUBLIC_APP_URL: 'https://app.example.test' })).toBe('https://app.example.test');
  });
  it.each(['http://app.example.test', 'https://user:password@app.example.test', 'https://app.example.test/?token=secret', 'https://app.example.test/#token=secret', 'https://app.example.test/path'])('rejects an unsafe origin %s', (PUBLIC_APP_URL) => expect(() => publicAppUrl({ NODE_ENV: 'production', PUBLIC_APP_URL })).toThrow());
  it('keeps delivery disabled by default outside development', () => {
    expect(mailDeliveryMode({ NODE_ENV: 'development' })).toBe('local');
    expect(mailDeliveryMode({ NODE_ENV: 'test' })).toBe('disabled');
    expect(mailDeliveryMode({ NODE_ENV: 'production' })).toBe('disabled');
    expect(() => mailDeliveryMode({ NODE_ENV: 'production', MAIL_DELIVERY_MODE: 'local' })).toThrow();
    expect(() => mailDeliveryMode({ NODE_ENV: 'development', MAIL_DELIVERY_MODE: 'smtp' })).toThrow();
  });
});
