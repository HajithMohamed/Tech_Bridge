import { createHash, randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import AuthChallenge from '../models/AuthChallenge';
import User, { type IUser } from '../models/User';
import { deliverMail, publicAppUrl } from './mailDelivery';

export type ChallengePurpose = 'verify_email' | 'password_reset';
export class AuthChallengeError extends Error {}
export function challengeHash(token: unknown): string {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthChallengeError('This link is invalid or has expired. Request a new link.');
  return createHash('sha256').update(token).digest('hex');
}
export function newPasswordValid(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72;
}
export function challengeUrl(base: string, purpose: ChallengePurpose, token: string) {
  const url = new URL(purpose === 'password_reset' ? '/reset-password' : '/verify-email', base);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function deliverAuthChallenge(user: Pick<IUser, '_id' | 'email'>, purpose: ChallengePurpose): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresIn = purpose === 'password_reset' ? 30 * 60_000 : 24 * 60 * 60_000;
  const challenge = await AuthChallenge.create({ userId: user._id, email: user.email, purpose, tokenHash: challengeHash(token), expiresAt: new Date(Date.now() + expiresIn) });
  try {
    const link = challengeUrl(publicAppUrl(), purpose, token);
    await deliverMail({ to: user.email, subject: purpose === 'password_reset' ? 'Reset your TechBridge password' : 'Verify your TechBridge email', text: purpose === 'password_reset'
      ? `Use this link to choose a new TechBridge password within 30 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this email. Your password has not changed.`
      : `Verify your email to finish creating your TechBridge account. This link expires in 24 hours:\n\n${link}\n\nProvider accounts also need the TechBridge team's separate organization verification.` });
  } catch {
    // Public request responses stay identical for unknown accounts and delivery
    // failures. Undelivered challenges must not remain usable.
    await AuthChallenge.deleteOne({ _id: challenge._id }).catch(() => undefined);
  }
}

const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export async function consumeAuthChallenge(token: unknown, purpose: ChallengePurpose, password?: unknown): Promise<void> {
  const tokenHash = challengeHash(token);
  if (purpose === 'password_reset' && !newPasswordValid(password)) throw new AuthChallengeError('Use at least 12 characters and at most 72 UTF-8 bytes for your password.');
  await mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const challenge = await AuthChallenge.findOneAndUpdate({ tokenHash, purpose, expiresAt: { $gt: now }, consumedAt: { $exists: false } }, { $set: { consumedAt: now } }, { new: true, session });
    if (!challenge) throw new AuthChallengeError('This link is invalid or has expired. Request a new link.');
    const user = await User.findOne({ _id: challenge.userId as Types.ObjectId, email: challenge.email }).select('+password +tokenVersion').session(session);
    if (!user) throw new AuthChallengeError('This link is invalid or has expired. Request a new link.');
    if (purpose === 'password_reset') {
      user.password = password as string;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ session });
    } else {
      if (user.requiresEmailVerification !== true || user.emailVerifiedAt) throw new AuthChallengeError('This link is invalid or has expired. Request a new link.');
      user.emailVerifiedAt = now;
      await user.save({ session });
    }
    await AuthChallenge.updateMany({ userId: user._id, purpose, consumedAt: { $exists: false } }, { $set: { consumedAt: now } }, { session });
  }, transactionOptions);
}
