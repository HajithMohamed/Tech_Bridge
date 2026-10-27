import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ChangeStream } from 'mongodb';
import User from '../models/User';
import Conversation from '../models/Conversation';
import MessagingSettings from '../models/MessagingSettings';
import { CommunityClaim } from '../models/CommunityClaim';
import { communityPair } from './communityMessaging';
import { communityVisible } from './communityPolicy';
import MessagingSignal from '../models/MessagingSignal';
import { verifyToken } from '../utils/jwt';
import { bearerToken } from '../utils/bearer';
import { AdminActionError } from './adminUsers';

export type MessageSignal = { type: 'refresh' } | { type: 'typing'; conversationId: string; expiresAt: number };
const subscribers = new Map<string, Set<(signal: MessageSignal) => Promise<void>>>();
const workerId = randomUUID();
let sharedStream: ChangeStream | undefined;
let retryWatch: ReturnType<typeof setTimeout> | undefined;
async function deliver(userIds: string[], signal: MessageSignal) {
  await Promise.allSettled([...new Set(userIds)].flatMap((id) => [...(subscribers.get(id) || [])].map((send) => send(signal))));
}
function watchSharedSignals() {
  if (sharedStream || !subscribers.size) return;
  let stream: ChangeStream;
  try { stream = MessagingSignal.watch([{ $match: { operationType: 'insert', 'fullDocument.workerId': { $ne: workerId } } }]); }
  catch { retryWatch = setTimeout(watchSharedSignals, 5000); return; }
  sharedStream = stream;
  stream.on('change', (change) => {
    if (change.operationType !== 'insert') return;
    const row = change.fullDocument;
    if (new Date(row.expiresAt).getTime() <= Date.now()) return;
    void deliver([String(row.ownerId)], row.type === 'typing' ? { type: 'typing', conversationId: String(row.conversationId), expiresAt: new Date(row.expiresAt).getTime() } : { type: 'refresh' });
  });
  stream.on('error', () => {
    if (sharedStream !== stream) return;
    sharedStream = undefined; void stream.close().catch(() => undefined);
    retryWatch = setTimeout(watchSharedSignals, 5000);
  });
}
export async function publishMessageSignal(userIds: string[], signal: MessageSignal = { type: 'refresh' }) {
  const ids = [...new Set(userIds)];
  // The message transaction has already committed. A transient signal failure
  // must not make a successful send look failed and invite duplicate retries.
  await Promise.allSettled([
    deliver(ids, signal),
    MessagingSignal.insertMany(ids.map((ownerId) => ({ ownerId, workerId, type: signal.type, ...(signal.type === 'typing' ? { conversationId: signal.conversationId } : {}), expiresAt: new Date(signal.type === 'typing' ? signal.expiresAt : Date.now() + 60_000) }))),
  ]);
}
export async function currentStreamUser(authorization: string | undefined) {
  const token = bearerToken(authorization);
  if (!token) throw new AdminActionError(401, 'Sign in to receive message updates.');
  let decoded;
  try { decoded = verifyToken(token); } catch { throw new AdminActionError(401, 'Your session expired. Sign in again.'); }
  if (decoded.scope !== undefined) throw new AdminActionError(401, 'A full session is required.');
  const user = await User.findById(decoded.userId).select('+tokenVersion');
  if (!user || (user.tokenVersion || 0) !== (decoded.version || 0)) throw new AdminActionError(401, 'Your session changed. Sign in again.');
  if (user.accountStatus === 'suspended' || (user.role === 'provider' && (!user.providerProfile?.verified || user.providerProfile.verificationStatus !== 'VERIFIED'))) throw new AdminActionError(403, 'Message updates are unavailable.');
  return user;
}
async function mayReceiveTyping(ownerId: string, conversationId: string) {
  const conversation = await Conversation.findOne({ _id: conversationId, participantIds: ownerId });
  if (!conversation) return false;
  const users = await User.find({ _id: { $in: conversation.participantIds } });
  if (users.length !== 2 || users.some((user) => user.accountStatus === 'suspended' || (user.role === 'provider' && (!user.providerProfile?.verified || user.providerProfile.verificationStatus !== 'VERIFIED')))) return false;
  const settings = await MessagingSettings.find({ ownerId: { $in: conversation.participantIds } });
  if (settings.some((row) => row.blockedIds.some((id) => conversation.participantIds.some((member) => member.equals(id))))) return false;
  if (settings.find((row) => String(row.ownerId) === ownerId)?.acceptsMessages === false) return false;
  if (communityPair(users[0], users[1])) {
    const provider = users.find((user) => user.role === 'provider');
    if (!provider) return false;
    const claim = await CommunityClaim.findOne({ providerId: provider._id });
    if (!communityVisible(provider, claim) || !claim?.profile.acceptsStudentMessages) return false;
  }
  return true;
}
export function openMessageStream(req: Request, res: Response) {
  const id = String(req.user!._id);
  const listeners = subscribers.get(id) || new Set();
  if (listeners.size >= 3 || [...subscribers.values()].reduce((count, rows) => count + rows.size, 0) >= 1000) throw new AdminActionError(429, 'Too many live message sessions.');
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let busy = false; let closed = false; let refreshPending = false;
  const close = () => {
    if (closed) return; closed = true; refreshPending = false; clearInterval(heartbeat); clearTimeout(lifetime); listeners.delete(send); if (!listeners.size) subscribers.delete(id);
    if (!subscribers.size) { clearTimeout(retryWatch); const stream = sharedStream; sharedStream = undefined; void stream?.close().catch(() => undefined); }
    res.end();
  };
  const send = async (signal: MessageSignal) => {
    if (closed) return;
    if (busy) {
      // Typing can expire, but a committed change needs a trailing refresh when
      // it arrives during another hint's asynchronous permission checks.
      if (signal.type === 'refresh') refreshPending = true;
      return;
    }
    busy = true;
    try {
      await currentStreamUser(req.headers.authorization);
      if (signal.type === 'typing' && !await mayReceiveTyping(id, signal.conversationId)) return;
      if (!closed && !res.write(`data: ${JSON.stringify(signal)}\n\n`)) close();
    } catch { close(); } finally {
      busy = false;
      if (refreshPending && !closed) {
        refreshPending = false;
        await send({ type: 'refresh' });
      }
    }
  };
  listeners.add(send); subscribers.set(id, listeners);
  watchSharedSignals();
  const heartbeat = setInterval(() => void send({ type: 'refresh' }), 15_000);
  const lifetime = setTimeout(close, 5 * 60_000);
  req.on('close', close); res.on('error', close);
  // No private message data, recipient names, JWTs or arbitrary room subscriptions.
  res.write('data: {"type":"refresh"}\n\n');
}
