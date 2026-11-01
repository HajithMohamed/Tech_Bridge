import { runNotificationBatch } from './notificationDelivery';
import { enqueueNotificationReminders } from './notificationReminders';
import { notificationWorkerConfiguration } from './notificationPolicy';

export async function notificationTick(batchSize = 20) {
  await enqueueNotificationReminders(100);
  return runNotificationBatch(batchSize);
}
/** One tick at a time; shutdown awaits its owned operation and never logs payloads. */
export function startNotificationWorker(configuration = notificationWorkerConfiguration(), tick: () => Promise<unknown> = () => notificationTick(configuration.batchSize)) {
  let stopped = !configuration.enabled; let timer: ReturnType<typeof setTimeout> | undefined; let current: Promise<unknown> = Promise.resolve();
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(run, configuration.pollMs); timer.unref();
  };
  const run = () => {
    if (stopped) return;
    current = Promise.resolve().then(tick).catch(() => { console.error('Notification worker is temporarily unavailable.'); }).finally(schedule);
  };
  run();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await current; };
}
