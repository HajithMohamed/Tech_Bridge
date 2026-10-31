import mongoose, { Types, type ClientSession } from 'mongoose';
import { enqueueDomainNotification } from './notifications';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { CommunityClaim, CommunityClaimEvent, type CommunityClaimRecord } from '../models/CommunityClaim';
import { VerificationDocument, VerificationEvent } from '../models/ProviderVerification';
import { directoryInstitution, findDirectoryContact } from '../data/communityDirectory';
import { adminId, adminReason, AdminActionError } from './adminUsers';
import { assertCommunityProvider, boundedText, claimRevision, claimTarget, claimTransition, communityProfile } from './communityPolicy';

const options = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
const eventFields = (claim: CommunityClaimRecord & { _id: Types.ObjectId }) => ({ claimId: claim._id, providerId: claim.providerId, directoryId: claim.directoryId, documentId: claim.documentId, revision: claim.revision });
async function lockProvider(id: Types.ObjectId, session: ClientSession, allowSuspended = false) {
  const provider = await User.findOneAndUpdate({ _id: id, role: 'provider', ...(!allowSuspended ? { accountStatus: { $ne: 'suspended' } } : {}) }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
  if (!provider) throw new AdminActionError(403, 'An active faculty or alumni provider account is required.');
  assertCommunityProvider(provider, allowSuspended); return provider;
}
export async function submitCommunityClaim(providerId: Types.ObjectId, body: Record<string, unknown>) {
  const revision = claimRevision(body.revision); const documentId = adminId(body.documentId);
  const justification = boundedText(body.justification, 'Identity claim explanation', 20, 1000);
  if (body.institution !== directoryInstitution) throw new AdminActionError(400, 'The selected directory requires University of Ruhuna affiliation.');
  return mongoose.connection.transaction(async (session) => {
    const provider = await lockProvider(providerId, session); const contact = claimTarget(body.directoryId, provider);
    if (provider.providerProfile?.verificationDocumentId?.toString() !== documentId || !await VerificationDocument.exists({ _id: documentId, providerId }).session(session)) throw new AdminActionError(409, 'Upload current supporting evidence through provider verification before submitting this claim.');
    let claim = await CommunityClaim.findOne({ providerId }).session(session);
    if ((claim?.revision || 0) !== revision) throw new AdminActionError(409, 'Your claim changed. Reload before resubmitting.');
    if (await CommunityClaim.exists({ directoryId: contact.id, status: 'APPROVED', providerId: { $ne: providerId } }).session(session)) throw new AdminActionError(409, 'This directory identity is already claimed. Contact support for an ownership dispute.');
    if (await CommunityClaimEvent.countDocuments({ providerId, action: 'submitted', createdAt: { $gte: new Date(Date.now() - 86400000) } }).session(session) >= 5) throw new AdminActionError(429, 'You can submit up to five claims in 24 hours.');
    const fromStatus = claim?.status || 'NONE';
    if (claim) {
      claim.directoryId = contact.id; claim.documentId = new Types.ObjectId(documentId); claim.institution = directoryInstitution;
      claim.justification = justification; claim.status = 'PENDING'; claim.revision += 1; claim.decisionReason = undefined;
      // Every renewed identity claim requires a fresh explicit visibility/messaging opt-in.
      claim.profile.visibility = 'hidden'; claim.profile.acceptsStudentMessages = false;
      await claim.save({ session });
    } else {
      [claim] = await CommunityClaim.create([{ providerId, directoryId: contact.id, documentId, institution: directoryInstitution, justification, status: 'PENDING', revision: 1 }], { session });
    }
    await CommunityClaimEvent.create([{ ...eventFields(claim), actorId: providerId, action: 'submitted', fromStatus, toStatus: 'PENDING', reason: justification }], { session });
    return claim;
  }, options);
}

export async function decideCommunityClaim(actorId: Types.ObjectId, claimValue: unknown, action: string, body: Record<string, unknown>) {
  const id = adminId(claimValue); const revision = claimRevision(body.revision); const reason = adminReason(body.reason); const documentId = adminId(body.documentId);
  let affiliationMethod: string | undefined; let affiliationReference: string | undefined;
  if (action === 'approve') {
    if (body.identityConfirmed !== true || body.affiliationConfirmed !== true || !['institution_confirmation', 'official_directory', 'alumni_records'].includes(body.affiliationMethod as string)) throw new AdminActionError(400, 'Independently confirm identity and affiliation and choose the verification method.');
    affiliationMethod = body.affiliationMethod as string; affiliationReference = boundedText(body.affiliationReference, 'Independent affiliation check reference', 20, 1000);
  }
  try {
    return await mongoose.connection.transaction(async (session) => {
      const actor = await User.updateOne({ _id: actorId, role: 'admin', accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { session, timestamps: false });
      if (actor.matchedCount !== 1) throw new AdminActionError(403, 'An active administrator is required.');
      const claim = await CommunityClaim.findById(id).session(session);
      if (!claim) throw new AdminActionError(404, 'Claim not found.');
      if (claim.providerId.equals(actorId)) throw new AdminActionError(403, 'You cannot review your own identity claim.');
      if (claim.revision !== revision || claim.documentId.toString() !== documentId) throw new AdminActionError(409, 'The claim or evidence changed. Reload the current submission.');
      const fromStatus = claim.status; const toStatus = claimTransition(fromStatus, action);
      const provider = await lockProvider(claim.providerId, session, action !== 'approve'); claimTarget(claim.directoryId, provider, action !== 'approve');
      if (action === 'approve') {
        if (provider.providerProfile!.verificationDocumentId?.toString() !== documentId || !await VerificationDocument.exists({ _id: documentId, providerId: provider._id }).session(session)) throw new AdminActionError(409, 'Supporting evidence changed. Ask the claimant to resubmit.');
        if (!await VerificationEvent.exists({ providerId: provider._id, actorId, documentId, action: 'document_reviewed', createdAt: { $gte: claim.updatedAt } }).session(session)) throw new AdminActionError(409, 'Download and review the current evidence after the latest claim update before approving.');
      }
      claim.status = toStatus; claim.decisionReason = reason; claim.revision += 1;
      if (toStatus !== 'APPROVED') { claim.profile.visibility = 'hidden'; claim.profile.acceptsStudentMessages = false; }
      await claim.save({ session });
      const fromVerification = provider.providerProfile!.verificationStatus || 'PENDING';
      // Reject/info decisions concern the claim only; revoke withdraws identity verification too.
      if (action === 'approve' || action === 'revoke') {
        const toVerification = action === 'approve' ? 'VERIFIED' : 'NEEDS_INFO';
        await User.updateOne({ _id: provider._id }, { $set: { 'providerProfile.verified': action === 'approve', 'providerProfile.verificationStatus': toVerification, 'providerProfile.rejectionReason': reason }, $inc: { tokenVersion: 1 } }, { session });
        await VerificationEvent.create([{ providerId: provider._id, actorId, documentId, action: action === 'approve' ? 'verified' : 'more_info', fromStatus: fromVerification, toStatus: toVerification, reason }], { session });
      }
      const eventAction = { approve: 'approved', reject: 'rejected', 'request-info': 'more_info', revoke: 'revoked' }[action];
      const [event] = await CommunityClaimEvent.create([{ ...eventFields(claim), actorId, action: eventAction, fromStatus, toStatus, reason, affiliationMethod, affiliationReference }], { session });
      await enqueueDomainNotification('verification', provider._id, `community:${event._id}`, claim._id, session, 'decision', 'community');
      await AuditLog.create([{ adminId: actorId, targetType: 'user', targetId: provider._id, action: `community_claim_${eventAction}`, reason, before: { role: 'provider', accountStatus: provider.accountStatus, verificationStatus: fromStatus }, after: { role: 'provider', accountStatus: provider.accountStatus, verificationStatus: toStatus } }], { session });
      return claim;
    }, options);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AdminActionError(409, 'This directory identity has already been approved for another account.');
    throw error;
  }
}

export async function updateCommunityProfile(providerId: Types.ObjectId, body: Record<string, unknown>) {
  const revision = claimRevision(body.revision); const profile = communityProfile(body.profile);
  return mongoose.connection.transaction(async (session) => {
    await lockProvider(providerId, session);
    const claim = await CommunityClaim.findOne({ providerId, revision }).session(session);
    if (!claim) throw new AdminActionError(409, 'Your claim changed. Reload before editing preferences.');
    claim.profile = profile; claim.revision += 1; await claim.save({ session });
    await CommunityClaimEvent.create([{ ...eventFields(claim), actorId: providerId, action: 'profile_updated', fromStatus: claim.status, toStatus: claim.status, reason: 'Owner updated community profile visibility, expertise, availability or messaging preferences.' }], { session });
    return claim;
  }, options);
}

/** Share the provider transaction so identity edits/withdrawals cannot reactivate old claims. */
export async function invalidateCommunityClaim(providerId: Types.ObjectId, actorId: Types.ObjectId, reason: string, action: 'identity_changed' | 'verification_changed', session: ClientSession) {
  const claim = await CommunityClaim.findOne({ providerId, status: { $in: ['APPROVED', 'PENDING'] } }).session(session);
  if (!claim) return;
  const fromStatus = claim.status; claim.status = 'NEEDS_INFO'; claim.decisionReason = reason; claim.revision += 1;
  claim.profile.visibility = 'hidden'; claim.profile.acceptsStudentMessages = false; await claim.save({ session });
  await CommunityClaimEvent.create([{ ...eventFields(claim), actorId, action, fromStatus, toStatus: 'NEEDS_INFO', reason }], { session });
}

export function publicCommunityMember(claim: CommunityClaimRecord & { _id: Types.ObjectId }) {
  const contact = findDirectoryContact(claim.directoryId)!;
  return { _id: claim.providerId, directoryId: claim.directoryId, fullName: contact.name, category: contact.category,
    department: 'department' in contact ? contact.department : undefined, institution: claim.institution,
    expertise: claim.profile.expertise, availability: claim.profile.availability, bio: claim.profile.bio,
    acceptsStudentMessages: claim.profile.acceptsStudentMessages,
    providerProfile: { organizationName: contact.name, organizationType: contact.category === 'academic' ? 'faculty' : 'alumni', description: claim.profile.bio } };
}
