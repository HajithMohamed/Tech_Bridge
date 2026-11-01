import type { Request, Response } from 'express';
import User from '../models/User';
import { CommunityClaim, CommunityClaimEvent, claimStatuses } from '../models/CommunityClaim';
import { adminId, adminPage, AdminActionError } from '../services/adminUsers';
import { assertCommunityProvider, boundedText, communityApproved, communityVisible } from '../services/communityPolicy';
import { decideCommunityClaim, publicCommunityMember, submitCommunityClaim, updateCommunityProfile } from '../services/communityVerification';
import { directoryContacts } from '../data/communityDirectory';

const failure = (res: Response, error: unknown) => {
  if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  res.status(503).json({ success: false, message: 'Unable to complete community verification. Please try again.' });
};
export const getOwnCommunityClaim = async (req: Request, res: Response) => {
  try {
    assertCommunityProvider(req.user!);
    const claim = await CommunityClaim.findOne({ providerId: req.user!._id });
    res.json({ success: true, data: { claim, active: communityApproved(req.user!, claim), kind: req.user!.providerProfile!.organizationType } });
  } catch (error) { failure(res, error); }
};
export const submitOwnCommunityClaim = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, data: { claim: await submitCommunityClaim(req.user!._id, req.body || {}) } }); }
  catch (error) { failure(res, error); }
};
export const saveOwnCommunityProfile = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { claim: await updateCommunityProfile(req.user!._id, req.body || {}) } }); }
  catch (error) { failure(res, error); }
};
function directoryFilters(query: Record<string, unknown>) {
  const q = query.q === undefined ? '' : boundedText(query.q, 'Search', 0, 100).toLowerCase();
  if (query.category !== undefined && !['academic', 'alumni'].includes(query.category as string)) throw new AdminActionError(400, 'Choose a valid community category.');
  if (query.department !== undefined && !['ICT', 'ET', 'BST', 'MDS', 'Faculty'].includes(query.department as string)) throw new AdminActionError(400, 'Choose a valid department.');
  return { q, contacts: directoryContacts.filter((contact) => (!query.category || contact.category === query.category) && (!query.department || ('department' in contact && contact.department === query.department))) };
}
export async function visibleCommunityPeople(query: Record<string, unknown>) {
  const page = adminPage(query.page); const { q, contacts } = directoryFilters(query);
  const claims = await CommunityClaim.find({ status: 'APPROVED', 'profile.visibility': 'members', directoryId: { $in: contacts.map((item) => item.id) } }).sort({ directoryId: 1 }).limit(directoryContacts.length);
  const providers = await User.find({ _id: { $in: claims.map((claim) => claim.providerId) } }).select('role accountStatus providerProfile.organizationType providerProfile.verified providerProfile.verificationStatus providerProfile.verificationDocumentId');
  const people = claims.filter((claim) => {
    const provider = providers.find((item) => item._id.equals(claim.providerId));
    return provider && communityVisible(provider, claim);
  }).map(publicCommunityMember).filter((member) => !q || [member.fullName, ...member.expertise, member.bio, member.institution].join(' ').toLowerCase().includes(q));
  return { people: people.slice((page - 1) * 20, page * 20), page, pages: Math.max(1, Math.ceil(people.length / 20)), total: people.length };
}
export const listCommunityPeople = async (req: Request, res: Response) => {
  try { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: await visibleCommunityPeople(req.query) }); }
  catch (error) { failure(res, error); }
};
export const listCommunityClaims = async (req: Request, res: Response) => {
  try {
    const page = adminPage(req.query.page); const status = req.query.status ?? 'PENDING';
    if (typeof status !== 'string' || !['ALL', ...claimStatuses].includes(status)) throw new AdminActionError(400, 'Choose a valid claim status.');
    const { q, contacts } = directoryFilters(req.query);
    const directoryIds = contacts.filter((item) => !q || [item.name, item.role].join(' ').toLowerCase().includes(q)).map((item) => item.id);
    const filter = { directoryId: { $in: directoryIds }, ...(status !== 'ALL' ? { status } : {}) };
    const [claims, total] = await Promise.all([
      CommunityClaim.find(filter).populate('providerId', 'fullName email accountStatus providerProfile.organizationType providerProfile.verificationDocumentId providerProfile.verificationStatus').sort({ createdAt: 1, _id: 1 }).skip((page - 1) * 20).limit(20),
      CommunityClaim.countDocuments(filter),
    ]);
    res.json({ success: true, data: { claims, page, pages: Math.max(1, Math.ceil(total / 20)), total } });
  } catch (error) { failure(res, error); }
};
export const communityClaimHistory = (admin: boolean) => async (req: Request, res: Response) => {
  try {
    const claim = admin ? await CommunityClaim.findById(adminId(req.params.id)) : await CommunityClaim.findOne({ providerId: req.user!._id });
    if (!claim) throw new AdminActionError(404, 'Claim not found.');
    const page = adminPage(req.query.page); const filter = { claimId: claim._id };
    const [entries, total] = await Promise.all([
      CommunityClaimEvent.find(filter).select(admin ? '' : '-affiliationReference').populate('actorId', 'fullName role').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20),
      CommunityClaimEvent.countDocuments(filter),
    ]);
    res.json({ success: true, data: { entries, page, pages: Math.max(1, Math.ceil(total / 20)), total } });
  } catch (error) { failure(res, error); }
};
export const communityDecision = (action: string) => async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { claim: await decideCommunityClaim(req.user!._id, req.params.id, action, req.body || {}) } }); }
  catch (error) { failure(res, error); }
};
