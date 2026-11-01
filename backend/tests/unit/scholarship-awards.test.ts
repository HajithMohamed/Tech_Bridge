import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { changeApplicationStatus, currentAcademicYearStart, isApplicationStatus, scholarshipCapacity } from '../../src/services/scholarshipAwards';
import { ids } from '../support/fixtures';

describe('scholarship award rules', () => {
  it.each([1, 2, 100, Number.MAX_SAFE_INTEGER])('accepts whole positive capacity %s', (capacity) => {
    expect(scholarshipCapacity(capacity)).toBe(capacity);
  });
  it('retains the legacy default only when capacity is absent', () => {
    expect(scholarshipCapacity(undefined)).toBe(1);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '2', {}])('fails closed for invalid capacity %j', (value) => {
    expect(() => scholarshipCapacity(value)).toThrow('invalid award capacity');
  });
  it.each(['applied', 'reviewed', 'accepted', 'rejected'])('preserves existing %s status', (status) => {
    expect(isApplicationStatus(status)).toBe(true);
  });
  it.each([undefined, null, '', 'awarded', 1, {}, ['accepted']])('rejects invalid status %j', (status) => {
    expect(isApplicationStatus(status)).toBe(false);
  });
  it.each(['bad-id', '', undefined, ['000000000000000000000001']])('rejects invalid ID before database access', async (id) => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(changeApplicationStatus(id, ids.provider, 'accepted')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid status before database access', async () => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(changeApplicationStatus(ids.scholarship.toString(), ids.provider, 'awarded')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([new Date(2025, 11, 31, 23, 59), new Date(2026, 0, 1, 0, 1)])('preserves server-local January boundaries at %s', (now) => {
    expect(currentAcademicYearStart(now)).toEqual(new Date(now.getFullYear(), 0, 1));
  });
});
