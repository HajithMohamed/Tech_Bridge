import { describe, expect, it } from 'vitest';
import { assertTestDatabase, TestDatabase } from '../support/database';

const safe = 'mongodb://127.0.0.1:27099/techbridge_test_0123456789abcdef0123456789abcdef';
describe('test database safety', () => {
  it('permits only a named disposable loopback database in test mode', () => {
    expect(() => assertTestDatabase(safe, 'test')).not.toThrow();
  });
  it.each([
    ['production', safe], ['development', safe],
    ['test', safe.replace('127.0.0.1', 'db.example.test')],
    ['test', safe.replace('/techbridge_test_0123456789abcdef0123456789abcdef', '/techbridge')],
    ['test', safe.replace('mongodb:', 'mongodb+srv:')],
    ['test', safe.replace('127.0.0.1', 'user:private-value@127.0.0.1')],
    ['test', 'not a uri'],
  ])('rejects unsafe database configuration without exposing it (%s)', (environment, uri) => {
    expect(() => assertTestDatabase(uri, environment)).toThrow();
    try { assertTestDatabase(uri, environment); } catch (error) {
      expect(String(error)).not.toContain(uri);
      expect(String(error)).not.toContain('private-value');
    }
  });
  it('refuses cleanup before owning a database', async () => {
    await expect(new TestDatabase().clear()).rejects.toThrow('No owned test database');
  });
});
