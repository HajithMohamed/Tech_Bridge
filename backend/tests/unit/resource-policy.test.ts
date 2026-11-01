import { describe, expect, it } from 'vitest';
import type { IResourceListing } from '../../src/models/Resource';
import Resource from '../../src/models/Resource';
import { allocationDates, isResourceOverdue, listingReturnPolicy, rankResources, resourceDate, resourceId, resourcePriority, resourceRevision, resourceText, returnPolicy } from '../../src/services/resourcePolicy';
import { canTransitionResourceRequest } from '../../src/services/resourceReservation';
import { resourceFixture } from '../support/fixtures';
const resource = (changes: Record<string, unknown> = {}) => ({ ...resourceFixture(), createdAt: new Date('2026-01-01'), ...changes }) as unknown as IResourceListing;
const now = new Date('2026-02-01T00:00:00.000Z');

describe('resource ownership, dates, priority and input policies', () => {
  it.each(['borrow', 'share', 'rent'])('requires physical return for %s', accessType => expect(returnPolicy(resource({ accessType })).returnRequired).toBe(true));
  it.each(['donation', 'sponsorship', 'installment', 'interest_free'])('does not invent a return obligation for %s', accessType => expect(returnPolicy(resource({ accessType })).returnRequired).toBe(false));
  it('supports explicitly returnable sponsorship and rejects contradictory transfer policies', () => {
    expect(listingReturnPolicy('sponsorship', 'returnable', 60)).toEqual({ returnPolicy: 'returnable', returnDurationDays: 60 });
    expect(returnPolicy(resource({ accessType: 'sponsorship', returnPolicy: 'returnable', returnDurationDays: 60 }))).toEqual({ returnRequired: true, durationDays: 60 });
    expect(() => listingReturnPolicy('donation', 'returnable', undefined)).toThrow();
    expect(() => listingReturnPolicy('borrow', 'transfer', undefined)).toThrow();
    expect(() => listingReturnPolicy('sponsorship', 'returnable', 0)).toThrow();
    expect(() => listingReturnPolicy('sponsorship', 'returnable', 3651)).toThrow();
    expect(() => listingReturnPolicy('rent', undefined, 30)).toThrow();
  });
  it('derives loan deadlines and preserves an explicit valid shorter deadline', () => {
    const item = resource({ accessType: 'borrow', accessDetails: { borrowShare: { borrowDurationDays: 7 } } });
    expect(allocationDates(item, undefined, undefined, now).dueAt).toEqual(new Date('2026-02-08T00:00:00Z'));
    expect(allocationDates(item, now.toISOString(), '2026-02-03T00:00:00Z', now).dueAt).toEqual(new Date('2026-02-03'));
    expect(() => allocationDates(item, now.toISOString(), '2026-02-09T00:00:00Z', now)).toThrow();
    expect(() => allocationDates(item, now.toISOString(), now.toISOString(), now)).toThrow();
    expect(() => allocationDates(item, '2025-01-01T00:00:00Z', undefined, now)).toThrow();
  });
  it('enforces rental minimum periods and documents thirty-day rental months', () => {
    const item = resource({ accessType: 'rent', accessDetails: { rent: { minRentalMonths: 2 } } });
    expect(returnPolicy(item).durationDays).toBe(60);
    expect(() => allocationDates(item, now.toISOString(), '2026-02-03T00:00:00Z', now)).toThrow();
    expect(allocationDates(item, now.toISOString(), '2026-04-02T00:00:00Z', now).returnRequired).toBe(true);
  });
  it('rejects borrowing dates on transfers and malformed listing durations', () => {
    expect(() => allocationDates(resource(), now.toISOString(), undefined, now)).toThrow();
    expect(() => returnPolicy(resource({ accessType: 'borrow', accessDetails: { borrowShare: { borrowDurationDays: 0 } } }))).toThrow();
  });
  it.each(['2026-02-30T00:00:00Z', 'tomorrow', 0, null, {}, '2026-02-01', '2026-02-01T00:00:00+05:30'])('rejects invalid or ambiguous date %j', value => expect(() => resourceDate(value)).toThrow());
  it('detects overdue outstanding loans without changing status or stock', () => {
    const row = { status: 'accepted' as const, allocation: { returnRequired: true, accessType: 'borrow' as const, inventoryReserved: true, dueAt: new Date('2026-01-31') } };
    expect(isResourceOverdue(row, now)).toBe(true);
    expect(isResourceOverdue({ ...row, status: 'completed' }, now)).toBe(false);
    expect(isResourceOverdue({ ...row, allocation: { ...row.allocation, returnRequired: false } }, now)).toBe(false);
    expect(isResourceOverdue({ status: 'accepted' }, now)).toBe(false);
    expect(isResourceOverdue({ ...row, allocation: { ...row.allocation, dueAt: now } }, now)).toBe(false);
  });
  it('clamps timing and need scores, penalizes only active category benefits and explains weights', () => {
    const item = resource(); const score = resourcePriority('high', true, 0, now, item);
    expect(score.priorityScore).toBeGreaterThanOrEqual(0); expect(score.priorityScore).toBeLessThanOrEqual(100);
    expect(score.priorityReasons.join(' ')).toContain('not independently verified');
    expect(resourcePriority('low', true, 0, now, item).priorityScore).toBeLessThan(score.priorityScore);
    expect(resourcePriority('high', true, 2, now, item).priorityScore).toBeLessThan(score.priorityScore);
    expect(resourcePriority('high', true, 0, new Date('2100-01-01'), item).components.timing).toBe(0);
    expect(resourcePriority('high', true, 0, new Date('2020-01-01'), item).components.timing).toBe(100);
    expect(resourcePriority('high', false, 10, now, item).components.benefits).toBe(0);
  });
  it('breaks tied priority by original submission time then ID', () => {
    const a = { _id: 'a', createdAt: now, prioritySnapshot: { priorityScore: 80 } }; const b = { ...a, _id: 'b' };
    expect(rankResources(a, b)).toBeLessThan(0); expect(rankResources(b, a)).toBeGreaterThan(0);
    expect(rankResources({ ...a, createdAt: new Date('2026-01-01') }, b)).toBeLessThan(0);
    expect(rankResources({ ...a, prioritySnapshot: { priorityScore: 99 } }, b)).toBeLessThan(0);
  });
  it.each([undefined, '', {}, ['000000000000000000000001'], 'not-an-id'])('rejects malformed ID %j', value => expect(() => resourceId(value)).toThrow());
  it('bounds reasons and prevents query/markup payloads', () => {
    expect(resourceText('  A meaningful reason  ', 'Reason')).toBe('A meaningful reason');
    for (const value of [{ $ne: null }, '<script>bad</script>', 'short', 'x'.repeat(1001)]) expect(() => resourceText(value, 'Reason')).toThrow();
    expect(resourceId('ABCDEF000000000000000001')).toBe('abcdef000000000000000001');
  });
  it('checks optional and mandatory optimistic revisions', () => {
    expect(() => resourceRevision(undefined, 0)).not.toThrow(); expect(() => resourceRevision(0, 0, true)).not.toThrow();
    for (const value of [undefined, '0', -1, .2, {}, Number.MAX_SAFE_INTEGER + 1]) expect(() => resourceRevision(value, 0, true)).toThrow();
    expect(() => resourceRevision(0, 1)).toThrow('changed');
  });
  it('permits deliberate waitlist decisions without reopening terminal allocations', () => {
    expect(canTransitionResourceRequest('pending', 'waitlisted')).toBe(true); expect(canTransitionResourceRequest('waitlisted', 'accepted')).toBe(true); expect(canTransitionResourceRequest('waitlisted', 'rejected')).toBe(true);
    expect(canTransitionResourceRequest('completed', 'accepted')).toBe(false); expect(canTransitionResourceRequest('cancelled', 'accepted')).toBe(false); expect(canTransitionResourceRequest('accepted', 'waitlisted')).toBe(false);
  });
  it.each([-.1, .5, 1_000_001, Number.MAX_SAFE_INTEGER + 1])('rejects invalid database inventory %j', quantityAvailable => {
    expect(new Resource(resourceFixture({ quantityAvailable })).validateSync()?.errors.quantityAvailable).toBeDefined();
  });
});
