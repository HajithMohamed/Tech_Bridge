import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { adminId, adminPage, adminReason, changeManagedUser, userListFilter } from '../../src/services/adminUsers';
import { ids } from '../support/fixtures';
describe('admin action validation', () => {
  it.each([undefined, '', 'ab', 'x'.repeat(1001), {}])('rejects invalid reasons %j', (value) => expect(() => adminReason(value)).toThrow());
  it('trims valid reasons', () => expect(adminReason('  Policy review  ')).toBe('Policy review'));
  it.each(['0', '-1', '1e3', '100001', ['2']])('rejects invalid pages %j', (value) => expect(() => adminPage(value)).toThrow());
  it('defaults and parses bounded pages', () => { expect(adminPage(undefined)).toBe(1); expect(adminPage('2')).toBe(2); });
  it('validates IDs', () => { expect(adminId(ids.student.toString())).toBe(ids.student.toString()); expect(() => adminId('bad')).toThrow(); });
  it('treats regex metacharacters as literal search text', () => expect(userListFilter({ q: 'a.*' })).toEqual({ $or: [{ fullName: { $regex: 'a\\.\\*', $options: 'i' } }, { email: { $regex: 'a\\.\\*', $options: 'i' } }] }));
  it.each([{ role: 'owner' }, { status: 'deleted' }, { q: ['x'] }])('rejects invalid filters %j', (value) => expect(() => userListFilter(value)).toThrow());
  it('rejects self changes before database access', async () => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(changeManagedUser(ids.admin, ids.admin.toString(), { kind: 'status', value: 'suspended' }, 'Valid reason')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
