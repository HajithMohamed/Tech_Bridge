import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import AuthRateLimit from '../models/AuthRateLimit';

export class AuthThrottleError extends Error {
  constructor(public readonly retryAfter: number) { super('Too many attempts. Please wait before trying again.'); }
}
export function authBucket(scope: string, identity: string, windowMs: number, now = Date.now()) {
  const start = Math.floor(now / windowMs) * windowMs;
  return { key: createHash('sha256').update(`${scope}\0${identity}\0${start}`).digest('hex'), expiresAt: new Date(start + windowMs), retryAfter: Math.max(1, Math.ceil((start + windowMs - now) / 1000)) };
}
export async function consumeAuthLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const bucket = authBucket(scope, identity, windowMs);
  let row;
  try {
    row = await AuthRateLimit.findOneAndUpdate({ _id: bucket.key }, { $inc: { attempts: 1 }, $setOnInsert: { expiresAt: bucket.expiresAt } }, { upsert: true, new: true });
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
    // Simultaneous first attempts may race the unique key's insertion.
    row = await AuthRateLimit.findOneAndUpdate({ _id: bucket.key }, { $inc: { attempts: 1 } }, { new: true });
  }
  if (!row) throw new Error('Authentication limit is unavailable.');
  if (row.attempts > limit) throw new AuthThrottleError(bucket.retryAfter);
}

export const authThrottle = (scope: 'login' | 'register' | 'forgot-password' | 'resend-verification' | 'reset-password' | 'verify-email') => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // The socket is supplied by Node, unlike user-controlled forwarding headers.
    const address = req.socket.remoteAddress || 'unknown-local-address';
    if (scope === 'login') {
      await consumeAuthLimit('login:network', address, 300, 15 * 60_000);
      await consumeAuthLimit('login:account', String(req.body.email).toLowerCase(), 10, 15 * 60_000);
    } else if (scope === 'reset-password' || scope === 'verify-email') {
      await consumeAuthLimit(`${scope}:network`, address, 40, 15 * 60_000);
    } else {
      await consumeAuthLimit(`${scope}:network`, address, 20, 60 * 60_000);
      await consumeAuthLimit(`${scope}:email`, String(req.body.email).toLowerCase(), 3, 60 * 60_000);
    }
    next();
  } catch (error) {
    if (error instanceof AuthThrottleError) {
      res.set('Retry-After', String(error.retryAfter));
      res.status(429).json({ success: false, message: error.message });
    } else res.status(503).json({ success: false, message: 'Account access is temporarily unavailable. Please try again.' });
  }
};
