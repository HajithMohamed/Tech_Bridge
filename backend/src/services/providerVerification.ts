import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { invalidateCommunityClaim } from './communityVerification';
import User, { IUser } from '../models/User';
import AuditLog from '../models/AuditLog';
import { VerificationDocument, VerificationEvent, type VerificationStatus } from '../models/ProviderVerification';
import { adminId, adminReason, AdminActionError } from './adminUsers';
import { validateVerificationDocument, verificationTransition } from './verificationPolicy';
import { enqueueDomainNotification } from './notifications';

export const verificationStatus = (provider: IUser): VerificationStatus => provider.providerProfile?.verificationStatus || 'PENDING';
const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
async function lockAdmin(actorId: Types.ObjectId, session: mongoose.ClientSession) {
  const actor = await User.updateOne({ _id: actorId, role: 'admin', accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { session, timestamps: false });
  if (actor.matchedCount !== 1) throw new AdminActionError(403, 'An active administrator is required.');
}
export async function submitVerificationDocument(providerId: Types.ObjectId, body: unknown) {
  const document = validateVerificationDocument(body);
  return mongoose.connection.transaction(async (session) => {
    const provider = await User.findOneAndUpdate({ _id: providerId, role: 'provider', accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { new: true, session });
    if (!provider?.providerProfile) throw new AdminActionError(403, 'An active provider account is required.');
    const fromStatus = verificationStatus(provider);
    if (fromStatus === 'VERIFIED') throw new AdminActionError(409, 'Your organization is already verified. Submit new evidence when requested by an administrator.');
    if (await VerificationDocument.countDocuments({ providerId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).session(session) >= 5) throw new AdminActionError(429, 'You can submit up to five documents in 24 hours.');
    const [stored] = await VerificationDocument.create([{ providerId, fileName: document.fileName, contentType: document.contentType, size: document.size, data: document.data, sha256: createHash('sha256').update(document.data).digest('hex') }], { session });
    await User.updateOne({ _id: providerId }, { $set: { 'providerProfile.verificationDocumentId': stored._id, 'providerProfile.verificationDocumentName': document.fileName, 'providerProfile.verificationStatus': 'PENDING', 'providerProfile.verified': false }, $unset: { 'providerProfile.rejectionReason': '' } }, { session });
    await VerificationEvent.create([{ providerId, actorId: providerId, documentId: stored._id, action: 'submitted', fromStatus, toStatus: 'PENDING', reason: document.note, readAt: new Date() }], { session });
    return { documentId: stored._id };
  }, transactionOptions);
}
export async function decideProviderVerification(actorId: Types.ObjectId, providerValue: unknown, action: 'verified' | 'rejected' | 'more_info', body: Record<string, unknown>) {
  const providerId = adminId(providerValue); const reason = adminReason(body?.reason);
  if (body.documentId !== null) adminId(body.documentId);
  return mongoose.connection.transaction(async (session) => {
    await lockAdmin(actorId, session);
    const provider = await User.findOne({ _id: providerId, role: 'provider' }).session(session);
    if (!provider?.providerProfile) throw new AdminActionError(404, 'Provider not found.');
    const profile = provider.providerProfile; const currentId = profile.verificationDocumentId?.toString() || null;
    if (body.documentId !== currentId) throw new AdminActionError(409, 'The supporting document changed. Reload and review the current submission.');
    const fromStatus = verificationStatus(provider); const toStatus = verificationTransition(fromStatus, action);
    if (action === 'verified') {
      if (provider.accountStatus === 'suspended') throw new AdminActionError(409, 'Reinstate this account before approving verification.');
      if (!currentId || !await VerificationDocument.exists({ _id: currentId, providerId }).session(session)) throw new AdminActionError(409, 'A stored supporting document is required before approval.');
      if (!await VerificationEvent.exists({ providerId, actorId, documentId: currentId, action: 'document_reviewed' }).session(session)) throw new AdminActionError(409, 'Download and review the current document before approving.');
    }
    const changed = await User.findOneAndUpdate({ _id: providerId }, { $set: { 'providerProfile.verified': toStatus === 'VERIFIED', 'providerProfile.verificationStatus': toStatus, 'providerProfile.rejectionReason': reason }, $inc: { tokenVersion: 1, __v: 1 } }, { new: true, runValidators: true, session });
    if (action !== 'verified') await invalidateCommunityClaim(provider._id, actorId, reason, 'verification_changed', session);
    const snapshot = (status: string) => ({ role: provider.role, accountStatus: provider.accountStatus || 'active', verificationStatus: status });
    await AuditLog.create([{ adminId: actorId, targetType: 'user', targetId: providerId, action: `provider_${action}`, reason, before: snapshot(fromStatus), after: snapshot(toStatus) }], { session });
    const [event] = await VerificationEvent.create([{ providerId, actorId, ...(currentId ? { documentId: currentId } : {}), action, fromStatus, toStatus, reason }], { session });
    await enqueueDomainNotification('verification', provider._id, `verification:${event._id}`, provider._id, session, 'decision');
    return changed;
  }, transactionOptions);
}
export async function reviewVerificationDocument(actorId: Types.ObjectId, providerValue: unknown, documentValue: unknown) {
  const providerId = adminId(providerValue); const documentId = adminId(documentValue);
  return mongoose.connection.transaction(async (session) => {
    await lockAdmin(actorId, session);
    const provider = await User.findOne({ _id: providerId, role: 'provider' }).session(session);
    const document = await VerificationDocument.findOne({ _id: documentId, providerId }).select('+data').session(session);
    if (!provider || !document) throw new AdminActionError(404, 'Document not found.');
    const status = verificationStatus(provider);
    await VerificationEvent.create([{ providerId, actorId, documentId, action: 'document_reviewed', fromStatus: status, toStatus: status, reason: 'Administrator downloaded supporting evidence for review.', readAt: new Date() }], { session });
    await AuditLog.create([{ adminId: actorId, targetType: 'user', targetId: providerId, action: 'provider_document_reviewed', reason: `Supporting document ${documentId} downloaded for review.` }], { session });
    return document;
  }, transactionOptions);
}

/** Identity edits invalidate the approval; ordinary service/description edits do not. */
export async function saveVerifiedProviderProfile(providerId: Types.ObjectId, expectedVersion: number, changes: Record<string, unknown>) {
  const identityFields = ['organizationName', 'contactPerson', 'contactEmail', 'phone', 'location', 'website'];
  const allowed = [...identityFields, 'logoUrl', 'description', 'opportunityCategories', 'resourceAccessMethods'];
  if (Object.keys(changes).some((field) => !allowed.includes(field))) throw new AdminActionError(400, 'Unsupported provider profile fields.');
  return mongoose.connection.transaction(async (session) => {
    const provider = await User.findOneAndUpdate({ _id: providerId, role: 'provider', accountStatus: { $ne: 'suspended' }, 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED',
      ...(expectedVersion === 0 ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] } : { __v: expectedVersion }),
    }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!provider?.providerProfile) throw new AdminActionError(409, 'Your profile or verification changed. Reload before editing.');
    const profile = provider.providerProfile as unknown as Record<string, unknown>;
    const identityChanged = identityFields.some((field) => Object.prototype.hasOwnProperty.call(changes, field) && (profile[field] || '') !== (changes[field] || ''));
    const fields = Object.fromEntries(Object.entries(changes).map(([field, value]) => [`providerProfile.${field}`, value]));
    const reason = 'Organization identity or contact details changed. Submit updated supporting evidence.';
    if (identityChanged) Object.assign(fields, { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'NEEDS_INFO', 'providerProfile.rejectionReason': reason });
    const updated = await User.findByIdAndUpdate(providerId, { $set: fields, ...(identityChanged ? { $inc: { tokenVersion: 1 } } : {}) }, { new: true, runValidators: true, session });
    if (identityChanged) await VerificationEvent.create([{ providerId, actorId: providerId, ...(provider.providerProfile.verificationDocumentId ? { documentId: provider.providerProfile.verificationDocumentId } : {}), action: 'profile_changed', fromStatus: 'VERIFIED', toStatus: 'NEEDS_INFO', reason, readAt: new Date() }], { session });
    if (identityChanged) await invalidateCommunityClaim(providerId, providerId, reason, 'identity_changed', session);
    return updated;
  }, transactionOptions);
}
