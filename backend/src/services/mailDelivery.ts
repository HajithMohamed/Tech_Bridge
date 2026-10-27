import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function publicAppUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const local = environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test';
  const value = environment.PUBLIC_APP_URL || (local ? 'http://localhost:5173' : '');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Configure a valid PUBLIC_APP_URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(local && loopback && url.protocol === 'http:'))) throw new Error('PUBLIC_APP_URL must be a secure application origin.');
  return url.origin;
}

export function mailDeliveryMode(environment: NodeJS.ProcessEnv = process.env): 'local' | 'disabled' {
  const mode = environment.MAIL_DELIVERY_MODE || (environment.NODE_ENV === 'development' ? 'local' : 'disabled');
  if (mode === 'disabled') return mode;
  if (mode === 'local' && ['development', 'test'].includes(environment.NODE_ENV || '')) return mode;
  throw new Error('Local mail delivery is available only in development or tests.');
}

/** Development-only private outbox. No network requests or real email delivery. */
export async function deliverMail(mail: { to: string; subject: string; text: string }): Promise<void> {
  if (mailDeliveryMode() !== 'local') throw new Error('Mail delivery is not configured.');
  if (typeof mail.to !== 'string' || mail.to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to) || typeof mail.subject !== 'string' || !mail.subject || mail.subject.length > 200 || /[\r\n]/.test(mail.subject) || typeof mail.text !== 'string' || !mail.text || mail.text.length > 20_000) throw new Error('Invalid mail delivery request.');
  const directory = resolve(__dirname, '../../.cache/mail');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, `${randomUUID()}.json`), JSON.stringify({ ...mail, createdAt: new Date().toISOString() }, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}
