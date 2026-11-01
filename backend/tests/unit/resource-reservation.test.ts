import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceRequestStatus } from '../../src/models/ResourceRequest';
import { canTransitionResourceRequest, isResourceRequestDecision, transitionResourceRequest } from '../../src/services/resourceReservation';
import { ids } from '../support/fixtures';

describe('resource request transitions', () => {
  const statuses: ResourceRequestStatus[] = ['pending', 'accepted', 'rejected', 'completed'];
  it.each(statuses.flatMap((current) => statuses.map((next) => ({ current, next }))))('$current -> $next follows the lifecycle', ({ current, next }) => {
    const expected = [`pending:accepted`, `pending:rejected`, `accepted:completed`].includes(`${current}:${next}`);
    expect(canTransitionResourceRequest(current, next)).toBe(expected);
  });

  it.each([undefined, null, '', 'pending', 'APPROVED', 1, {}, ['accepted']])('rejects invalid decision %j', (value) => {
    expect(isResourceRequestDecision(value)).toBe(false);
  });
  it.each(['accepted', 'rejected', 'completed'])('recognizes the %s decision', (value) => {
    expect(isResourceRequestDecision(value)).toBe(true);
  });
  it.each(['invalid-id', '', undefined, ['000000000000000000000001']])('rejects malformed IDs before starting a transaction', async (value) => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(transitionResourceRequest(value, ids.provider, 'accepted')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects an invalid status before starting a transaction', async () => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(transitionResourceRequest(ids.resource.toString(), ids.provider, 'pending')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
