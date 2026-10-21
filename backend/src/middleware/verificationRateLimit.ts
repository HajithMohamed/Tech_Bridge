import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Process-local bounds; deploy a shared edge limiter before horizontal scaling. */
export function verificationSessionLimit(now: () => number = Date.now): RequestHandler {
  const buckets = new Map<string, { count: number; expires: number }>();
  const windowMs = 15 * 60 * 1000;
  return (req, res, next) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const keys: [string, number][] = [[`ip:${req.ip || 'unknown'}`, 60], [`email:${createHash('sha256').update(email).digest('hex')}`, 10]];
    if (keys.some(([key, limit]) => (buckets.get(key)?.count || 0) >= limit) || buckets.size >= 5000) {
      res.set('Retry-After', '900').status(429).json({ success: false, message: 'Too many verification sign-in attempts. Please try again in 15 minutes.' });
      return;
    }
    for (const [key] of keys) {
      const bucket = buckets.get(key) || { count: 0, expires: time + windowMs };
      bucket.count++; buckets.set(key, bucket);
    }
    next();
  };
}
