import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultNotificationPreferences, notificationId, notificationKind, notificationKinds, notificationPage, notificationPreferencesInput, notificationRetry, notificationTemplate, notificationWorkerConfiguration } from '../../src/services/notificationPolicy';
import { startNotificationWorker } from '../../src/services/notificationWorker';
import Notification from '../../src/models/Notification';
import NotificationOutbox from '../../src/models/NotificationOutbox';
import { ids } from '../support/fixtures';
afterEach(() => vi.useRealTimers());

describe('notification templates, preferences and bounded inputs', () => {
  it.each(notificationKinds)('renders safe role-specific %s templates without source content', kind => {
    for (const role of ['student', 'provider', 'admin']) {
      const result = notificationTemplate(kind, role); expect(result.title.length).toBeLessThanOrEqual(100); expect(result.body.length).toBeLessThanOrEqual(500); expect(result.href).toMatch(/^\/(?!\/)/); expect(result.body).not.toMatch(/@|<|https?:|password|document/i);
    }
  });
  it('routes provider verification and community decisions outside the provider portal', () => {
    expect(notificationTemplate('verification', 'provider').href).toBe('/provider-verification'); expect(notificationTemplate('verification', 'provider', 'decision', 'community').href).toBe('/community-verification');
    expect(notificationTemplate('campaign', 'student', 'invited').title).toContain('invitation'); expect(notificationTemplate('resource', 'student', 'overdue').title).toContain('overdue');
  });
  it('returns independent default preference objects', () => {
    const a = defaultNotificationPreferences(); a.categories.message = false; expect(defaultNotificationPreferences().categories.message).toBe(true); expect(a.inApp).toBe(true);
    expect(notificationPreferencesInput({ ...defaultNotificationPreferences(), revision: 0 }).revision).toBe(0);
  });
  it.each([null, [], {}, { ...defaultNotificationPreferences(), revision: '0' }, { ...defaultNotificationPreferences(), revision: -1 }, { ...defaultNotificationPreferences(), revision: 0, ownerId: String(ids.admin) }, { ...defaultNotificationPreferences(), revision: 0, email: true }, { inApp: true, revision: 0, categories: { message: true } }, { inApp: true, revision: 0, categories: { ...defaultNotificationPreferences().categories, message: 'true' } }])('rejects invalid consent or authority fields %j', value => expect(() => notificationPreferencesInput(value)).toThrow());
  it.each(['0', '-1', '1.5', '10001', 'Infinity', {}, [], '1'.repeat(40)])('rejects invalid pagination %j', value => expect(() => notificationPage(value)).toThrow());
  it('bounds pagination and IDs without passing query operators to MongoDB', () => {
    expect(notificationPage(undefined)).toBe(1); expect(notificationPage('10000')).toBe(10000); expect(notificationId(String(ids.student).toUpperCase())).toBe(String(ids.student));
    for (const value of [{ $ne: null }, [], 'not-an-id']) expect(() => notificationId(value)).toThrow();
    expect(() => notificationKind({ $ne: null })).toThrow(); expect(() => notificationKind('private')).toThrow();
  });
  it('has bounded exponential retry delays', () => {
    const now = new Date('2026-01-01'); expect(notificationRetry(1, now).getTime() - now.getTime()).toBe(5000); expect(notificationRetry(5, now).getTime() - now.getTime()).toBe(80_000); expect(notificationRetry(100, now).getTime() - now.getTime()).toBe(3600_000);
  });
  it('validates model category, href and state before persistence', () => {
    const fields = { ownerId: ids.student, kind: 'campaign', title: 'Campaign update', body: 'Open your workspace.', href: '/my-promotion-requests', dedupeKey: 'synthetic', occurredAt: new Date() };
    expect(new Notification(fields).validateSync()).toBeUndefined(); expect(new Notification({ ...fields, href: 'https://evil.example.test' }).validateSync()).toBeDefined(); expect(new NotificationOutbox({ ...fields, status: 'sent-with-no-proof' }).validateSync()).toBeDefined();
  });
});
describe('notification worker scheduling', () => {
  it.each([{ NOTIFICATION_WORKER_ENABLED: 'yes' }, { NOTIFICATION_POLL_MS: '999' }, { NOTIFICATION_POLL_MS: '60001' }, { NOTIFICATION_BATCH_SIZE: '0' }, { NOTIFICATION_BATCH_SIZE: '101' }, { NOTIFICATION_BATCH_SIZE: '1.5' }])('rejects invalid worker settings %j', values => expect(() => notificationWorkerConfiguration(values)).toThrow());
  it('uses a bounded enabled worker by default and permits explicit disablement', () => {
    expect(notificationWorkerConfiguration({})).toEqual({ enabled: true, pollMs: 5000, batchSize: 20 }); expect(notificationWorkerConfiguration({ NOTIFICATION_WORKER_ENABLED: 'false' }).enabled).toBe(false);
  });
  it('does not overlap ticks and waits for its owned work on shutdown', async () => {
    vi.useFakeTimers(); let finish!: () => void; const tick = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = startNotificationWorker({ enabled: true, pollMs: 1000, batchSize: 1 }, tick); await vi.advanceTimersByTimeAsync(10000); expect(tick).toHaveBeenCalledTimes(1);
    let stopped = false; const stopping = stop().then(() => { stopped = true; }); await Promise.resolve(); expect(stopped).toBe(false); finish(); await stopping;
    await vi.advanceTimersByTimeAsync(10000); expect(tick).toHaveBeenCalledTimes(1);
  });
  it('recovers from a failed tick without logging private error content', async () => {
    vi.useFakeTimers(); const log = vi.spyOn(console, 'error').mockImplementation(() => undefined); const tick = vi.fn().mockRejectedValueOnce(new Error('Private recipient or database value')).mockResolvedValue(undefined);
    const stop = startNotificationWorker({ enabled: true, pollMs: 1000, batchSize: 1 }, tick); await vi.advanceTimersByTimeAsync(1001); expect(tick).toHaveBeenCalledTimes(2); expect(JSON.stringify(log.mock.calls)).not.toContain('Private'); await stop();
  });
  it('does no work when disabled', async () => {
    vi.useFakeTimers(); const tick = vi.fn(); const stop = startNotificationWorker({ enabled: false, pollMs: 1000, batchSize: 1 }, tick); await vi.advanceTimersByTimeAsync(10000); await stop(); expect(tick).not.toHaveBeenCalled();
  });
});
