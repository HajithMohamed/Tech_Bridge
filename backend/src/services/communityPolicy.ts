import type { IUser } from '../models/User';
import type { ClaimStatus, CommunityClaimRecord, CommunityProfile } from '../models/CommunityClaim';
import { findDirectoryContact } from '../data/communityDirectory';
import { AdminActionError } from './adminUsers';

export function boundedText(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new AdminActionError(400, `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function assertCommunityProvider(user: Pick<IUser, 'role' | 'accountStatus' | 'providerProfile'>, allowSuspended = false) {
  if (user.role !== 'provider' || (!allowSuspended && user.accountStatus === 'suspended') || !['faculty', 'alumni'].includes(user.providerProfile?.organizationType || '')) throw new AdminActionError(403, 'An active faculty or alumni provider account is required.');
}
export function claimTarget(value: unknown, user: Pick<IUser, 'role' | 'accountStatus' | 'providerProfile'>, allowSuspended = false) {
  assertCommunityProvider(user, allowSuspended);
  const contact = typeof value === 'string' ? findDirectoryContact(value) : undefined;
  if (!contact || (contact.category === 'academic' ? 'faculty' : 'alumni') !== user.providerProfile!.organizationType) throw new AdminActionError(400, 'Choose a directory identity matching your faculty/alumni account type.');
  return contact;
}
export function claimRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new AdminActionError(400, 'Provide the current claim revision.');
  return value as number;
}
export function claimTransition(status: ClaimStatus, action: string): ClaimStatus {
  if (action === 'revoke' && status === 'APPROVED') return 'REVOKED';
  if (status === 'PENDING') {
    if (action === 'approve') return 'APPROVED';
    if (action === 'reject') return 'REJECTED';
    if (action === 'request-info') return 'NEEDS_INFO';
  }
  throw new AdminActionError(409, 'This decision is not valid for the current claim status. Reload the claim.');
}
export function communityProfile(value: unknown): CommunityProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminActionError(400, 'Provide community profile preferences.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['visibility', 'acceptsStudentMessages', 'expertise', 'availability', 'bio'].includes(key))) throw new AdminActionError(400, 'Unsupported community profile fields.');
  if (!['hidden', 'members'].includes(body.visibility as string) || typeof body.acceptsStudentMessages !== 'boolean') throw new AdminActionError(400, 'Choose profile visibility and messaging preferences.');
  if (!Array.isArray(body.expertise) || body.expertise.length > 12) throw new AdminActionError(400, 'Provide up to 12 expertise topics.');
  return { visibility: body.visibility as CommunityProfile['visibility'], acceptsStudentMessages: body.acceptsStudentMessages,
    expertise: [...new Set(body.expertise.map((item) => boundedText(item, 'Expertise', 1, 80)))],
    availability: boundedText(body.availability, 'Availability', 0, 200), bio: boundedText(body.bio, 'Biography', 0, 1000) };
}
export function communityApproved(user: Pick<IUser, '_id' | 'role' | 'accountStatus' | 'providerProfile'>, claim: CommunityClaimRecord | null): boolean {
  const contact = claim && findDirectoryContact(claim.directoryId);
  return Boolean(contact && claim && claim.status === 'APPROVED' && claim.providerId.equals(user._id) && user.role === 'provider' && user.accountStatus !== 'suspended' && user.providerProfile?.verified === true && user.providerProfile.verificationStatus === 'VERIFIED' && user.providerProfile.verificationDocumentId?.equals(claim.documentId) && (contact.category === 'academic' ? 'faculty' : 'alumni') === user.providerProfile.organizationType);
}
export function communityVisible(user: Parameters<typeof communityApproved>[0], claim: CommunityClaimRecord | null): boolean {
  return communityApproved(user, claim) && claim?.profile.visibility === 'members';
}
