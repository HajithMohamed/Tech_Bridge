export const notificationKinds = ['campaign', 'message', 'application', 'scholarship', 'resource', 'verification', 'mentorship', 'event'] as const;
export type NotificationKind = typeof notificationKinds[number];
export const notificationActions = ['updated', 'invited', 'decision', 'appeal', 'deadline', 'due', 'overdue', 'return', 'submitted'] as const;
export type NotificationAction = typeof notificationActions[number];
export const notificationHrefs = ['/', '/opportunities', '/messages', '/my-applications', '/provider/applications', '/my-resource-requests', '/provider/resource-requests', '/my-activity', '/provider-verification', '/community-verification', '/my-promotion-requests', '/provider/promotion-requests', '/impact', '/admin'] as const;
export class NotificationError extends Error { constructor(public readonly statusCode: number, message: string) { super(message); } }
export function notificationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new NotificationError(400, 'Invalid notification ID.'); return value.toLowerCase();
}
export function notificationPage(value: unknown, fallback = 1, max = 10_000) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new NotificationError(400, 'Invalid notification page or limit.'); return Number(value);
}
export function notificationKind(value: unknown): NotificationKind {
  if (!notificationKinds.includes(value as NotificationKind)) throw new NotificationError(400, 'Invalid notification category.'); return value as NotificationKind;
}
export const defaultNotificationPreferences = () => ({ inApp: true, categories: Object.fromEntries(notificationKinds.map(kind => [kind, true])) as Record<NotificationKind, boolean> });
export function notificationPreferencesInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NotificationError(400, 'Provide notification preferences.');
  const values = body as Record<string, unknown>;
  if (Object.keys(values).some(key => !['revision', 'inApp', 'categories'].includes(key)) || !Number.isSafeInteger(values.revision) || (values.revision as number) < 0 || typeof values.inApp !== 'boolean' || !values.categories || typeof values.categories !== 'object' || Array.isArray(values.categories)) throw new NotificationError(400, 'Provide a revision, inApp boolean and category preferences.');
  const categories = values.categories as Record<string, unknown>;
  if (notificationKinds.filter(kind => kind !== 'event').some(kind => typeof categories[kind] !== 'boolean') || Object.keys(categories).some(key => !notificationKinds.includes(key as NotificationKind)) || Object.values(categories).some(value => typeof value !== 'boolean')) throw new NotificationError(400, 'Provide a boolean for each existing notification category. Event may be omitted by older clients.');
  return { revision: values.revision as number, inApp: values.inApp, categories: categories as Partial<Record<NotificationKind, boolean>> };
}
export function notificationTemplate(kind: NotificationKind, role: string, action: NotificationAction = 'updated', sourceType?: string) {
  if (kind === 'event') return { title: action === 'due' ? 'Campus event reminder' : sourceType === 'event_organizer' ? 'Campus organizer approval update' : 'Campus event update', body: 'Your campus event activity has an update.', href: '/impact' };
  if (kind === 'application' && sourceType === 'opportunity') return { title: 'Saved opportunity deadline approaching', body: 'Review your saved opportunity and its current application deadline.', href: '/opportunities' };
  const provider = role === 'provider';
  const titles: Record<NotificationKind, string> = { campaign: action === 'invited' ? 'Collaboration invitation' : 'Collaboration update', message: 'New message', application: 'Application update', scholarship: action === 'deadline' ? 'Scholarship deadline approaching' : action === 'appeal' ? 'Scholarship appeal update' : 'Scholarship application update', resource: action === 'overdue' ? 'Resource return overdue' : action === 'due' ? 'Resource return reminder' : action === 'return' ? 'Resource return update' : 'Resource request update', verification: 'Verification update', mentorship: 'Mentorship update', event: 'Campus event update' };
  const hrefs: Record<NotificationKind, string> = { campaign: provider ? '/provider/promotion-requests' : '/my-promotion-requests', message: '/messages', application: provider ? '/provider/applications' : '/my-applications', scholarship: provider ? '/provider/applications' : '/my-applications', resource: provider ? '/provider/resource-requests' : '/my-activity', verification: sourceType === 'community' ? '/community-verification' : '/provider-verification', mentorship: '/impact', event: '/impact' };
  return { title: titles[kind], body: kind === 'message' ? 'Open your messages to review a new message.' : 'Open your authorized workspace to review the update and any required next steps.', href: role === 'admin' && !['message', 'mentorship'].includes(kind) ? '/admin' : hrefs[kind] };
}
export function notificationRetry(attempt: number, now: Date) { return new Date(now.getTime() + Math.min(3600_000, 5000 * 2 ** Math.max(0, Math.min(10, attempt - 1)))); }
export function notificationWorkerConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const flag = environment.NOTIFICATION_WORKER_ENABLED ?? 'true';
  if (!['true', 'false'].includes(flag)) throw new Error('NOTIFICATION_WORKER_ENABLED must be true or false.');
  const poll = environment.NOTIFICATION_POLL_MS ?? '5000'; const batch = environment.NOTIFICATION_BATCH_SIZE ?? '20';
  if (!/^\d+$/.test(poll) || Number(poll) < 1000 || Number(poll) > 60_000 || !/^\d+$/.test(batch) || Number(batch) < 1 || Number(batch) > 100) throw new Error('Configure a notification poll interval of 1000..60000 ms and batch size 1..100.');
  return { enabled: flag === 'true', pollMs: Number(poll), batchSize: Number(batch) };
}
