import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { enqueueNotification } from '../../src/services/notifications';
import { TestDatabase } from '../support/database';

const database = new TestDatabase();
const notice = () => ({ ownerId: String(new Types.ObjectId()), kind: 'campaign' as const, title: 'Campaign updated', body: 'Review your campaign workspace.', href: '/my-promotion-requests', dedupeKey: 'synthetic-campaign:revision:1' });
beforeAll(() => database.start()); beforeEach(() => database.clear()); afterAll(() => database.stop());
describe('pending campaign notice support', () => {
  it('stores one pending notice per owner/key and does not claim delivery', async () => {
    const values = notice();
    await mongoose.connection.transaction(async (session) => { await enqueueNotification(values, session); await enqueueNotification(values, session); });
    expect(await NotificationOutbox.countDocuments()).toBe(1);
    expect((await NotificationOutbox.findOne())?.status).toBe('pending');
  });
  it('rolls the notice back with its caller transaction', async () => {
    await expect(mongoose.connection.transaction(async (session) => { await enqueueNotification(notice(), session); throw new Error('Synthetic workflow rollback'); })).rejects.toThrow('Synthetic workflow rollback');
    expect(await NotificationOutbox.countDocuments()).toBe(0);
  });
  it('rejects arbitrary external links and malformed recipients', async () => {
    await expect(mongoose.connection.transaction(async (session) => enqueueNotification({ ...notice(), href: 'https://example.test/private' }, session))).rejects.toThrow('Invalid');
    await expect(mongoose.connection.transaction(async (session) => enqueueNotification({ ...notice(), ownerId: 'invalid' }, session))).rejects.toThrow('Invalid');
    expect(await NotificationOutbox.countDocuments()).toBe(0);
  });
});
