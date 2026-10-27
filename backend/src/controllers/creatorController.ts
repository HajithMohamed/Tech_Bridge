import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import PromotionRequest from '../models/PromotionRequest';
import User, { type CreatorPlatform, type ICreatorProfile, type IUser } from '../models/User';
import { AdminActionError } from '../services/adminUsers';
import { creatorAvailability, creatorCompensation, creatorId, creatorPage, creatorPlatforms, creatorProfileInput, creatorQueryText, creatorRevision, literalCreatorSearch, publicCreator } from '../services/creatorPolicy';
import { changeCampaign, createCampaign, type CampaignMutation } from '../services/creatorCampaigns';
import { campaignStage } from '../services/campaignLifecycle';

const providerFields = 'fullName providerProfile.organizationName providerProfile.organizationType providerProfile.verified';
const creatorFields = 'fullName studentProfile.institution studentProfile.creatorProfile';
function failure(res: Response, error: unknown) {
  res.status(error instanceof AdminActionError ? error.statusCode : 503).json({ success: false, message: error instanceof AdminActionError ? error.message : 'Creator services are temporarily unavailable. Please try again.' });
}
const verifyProvider = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.providerProfile?.verified || req.user.providerProfile.verificationStatus !== 'VERIFIED') {
    res.status(403).json({ success: false, message: 'Only verified providers can access the creator marketplace.' }); return;
  }
  next();
};
async function mutateOwnedProfile(req: Request, profile?: ICreatorProfile, visibility?: boolean) {
  const expectedRevision = creatorRevision(req.body?.revision);
  return mongoose.connection.transaction(async (session) => {
    // Lock the account so concurrent profile edits/revocation serialize and retry safely.
    const owner = await User.findOneAndUpdate({ _id: req.user!._id, role: 'student', accountStatus: 'active' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!owner?.studentProfile) throw new AdminActionError(404, 'Student profile not found.');
    const current = owner.toObject().studentProfile?.creatorProfile;
    const revision = current?.revision ?? 0;
    if (!Number.isSafeInteger(revision) || revision >= Number.MAX_SAFE_INTEGER || (expectedRevision !== undefined && expectedRevision !== revision)) throw new AdminActionError(409, 'Your creator profile changed. Reload it before trying again.');
    // Enabling discovery revalidates stored legacy profiles. Withdrawal requires no other fields.
    const replacement = profile ?? (visibility === true ? creatorProfileInput({ ...current, isDiscoverable: true }) : undefined);
    const updates = replacement ? { 'studentProfile.creatorProfile': { ...replacement, revision: revision + 1 } } : { 'studentProfile.creatorProfile.isDiscoverable': false, 'studentProfile.creatorProfile.revision': revision + 1 };
    const updated = await User.findByIdAndUpdate(owner._id, { $set: updates }, { new: true, session, runValidators: true });
    if (!updated) throw new AdminActionError(404, 'Student profile not found.');
    return updated;
  });
}
const visibleCampaigns = { $or: [{ workflowVersion: { $ne: 2 } }, { publishedAt: { $exists: true, $ne: null } }] };
function campaignView(row: InstanceType<typeof PromotionRequest>) {
  const value = row.toObject(); const creator = value.studentId as unknown as IUser | null;
  const profile = creator?.studentProfile?.creatorProfile;
  const creatorView = creator ? (profile?.isDiscoverable ? publicCreator(creator) : { _id: creator._id, fullName: profile?.displayName || creator.fullName, studentProfile: { creatorProfile: { isDiscoverable: false, niches: [], platforms: [] } } }) : null;
  return { ...value, stage: campaignStage(row), studentId: creatorView };
}
async function campaignResponse(id: mongoose.Types.ObjectId, user: IUser) {
  const owner = user.role === 'student' ? { studentId: user._id, ...visibleCampaigns } : { providerId: user._id };
  const row = await PromotionRequest.findOne({ _id: id, ...owner }).populate('studentId', creatorFields).populate('providerId', providerFields);
  if (!row) throw new AdminActionError(404, 'Campaign request not found.');
  return campaignView(row);
}
export const updateCreatorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = creatorProfileInput(req.body);
    const student = await mutateOwnedProfile(req, profile);
    res.json({ success: true, message: profile.isDiscoverable ? 'Your creator profile is visible to verified providers.' : 'Your creator profile is hidden from providers.', data: { user: student } });
  } catch (error) { failure(res, error); }
};
export const updateCreatorVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    if (typeof req.body?.isDiscoverable !== 'boolean') throw new AdminActionError(400, 'Choose whether your creator profile is discoverable.');
    const student = await mutateOwnedProfile(req, undefined, req.body.isDiscoverable);
    res.json({ success: true, message: req.body.isDiscoverable ? 'Your creator profile is visible to verified providers.' : 'Your creator profile is hidden from providers.', data: { user: student } });
  } catch (error) { failure(res, error); }
};
export const listCreators = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true };
    const q = creatorQueryText(req.query.q); const niche = creatorQueryText(req.query.niche); const contentType = creatorQueryText(req.query.contentType);
    const platform = creatorQueryText(req.query.platform); const compensation = creatorQueryText(req.query.compensationPreference);
    const availability = creatorQueryText(req.query.availability);
    if (platform && !creatorPlatforms.includes(platform as CreatorPlatform)) throw new AdminActionError(400, 'Choose a valid platform filter.');
    if (compensation && !creatorCompensation.includes(compensation as typeof creatorCompensation[number])) throw new AdminActionError(400, 'Choose a valid compensation filter.');
    if (availability && !creatorAvailability.includes(availability as typeof creatorAvailability[number])) throw new AdminActionError(400, 'Choose a valid availability filter.');
    if (niche) filter['studentProfile.creatorProfile.niches'] = { $regex: literalCreatorSearch(niche), $options: 'i' };
    if (contentType) filter['studentProfile.creatorProfile.contentTypes'] = { $regex: literalCreatorSearch(contentType), $options: 'i' };
    if (platform) filter['studentProfile.creatorProfile.platforms.platform'] = platform;
    if (compensation) filter['studentProfile.creatorProfile.compensationPreference'] = compensation;
    const clauses: Record<string, unknown>[] = [];
    if (q) {
      const literal = { $regex: literalCreatorSearch(q), $options: 'i' };
      clauses.push({ $or: [{ 'studentProfile.creatorProfile.displayName': literal }, { $and: [{ $or: [{ 'studentProfile.creatorProfile.displayName': { $exists: false } }, { 'studentProfile.creatorProfile.displayName': '' }] }, { fullName: literal }] }] });
    }
    if (availability === 'available') clauses.push({ $or: [{ 'studentProfile.creatorProfile.availability': 'available' }, { 'studentProfile.creatorProfile.availability': { $exists: false } }] });
    else if (availability) filter['studentProfile.creatorProfile.availability'] = availability;
    if (clauses.length) filter.$and = clauses;
    const page = creatorPage(req.query.page); const limit = creatorPage(req.query.limit, 12, 24);
    const [students, total] = await Promise.all([User.find(filter).select(creatorFields).sort({ 'studentProfile.creatorProfile.displayName': 1, fullName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
    res.json({ success: true, data: { creators: students.map(publicCreator), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { failure(res, error); }
};
export const getCreator = async (req: Request, res: Response): Promise<void> => {
  try {
    const creator = await User.findOne({ _id: creatorId(req.params.studentId), role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true }).select(creatorFields);
    if (!creator) throw new AdminActionError(404, 'Creator profile not found.');
    res.json({ success: true, data: { creator: publicCreator(creator) } });
  } catch (error) { failure(res, error); }
};
export const createPromotionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = await createCampaign(req.user!._id, req.body);
    res.status(201).json({ success: true, message: req.body.saveAsDraft ? 'Campaign draft saved.' : 'Promotion request sent.', data: { request: await campaignResponse(id, req.user!) } });
  } catch (error) { failure(res, error); }
};
const listCampaigns = (forProvider: boolean) => async (req: Request, res: Response): Promise<void> => {
  try {
    const page = creatorPage(req.query.page); const limit = creatorPage(req.query.limit, 20, 50); const status = creatorQueryText(req.query.status);
    if (status && !['pending', 'accepted', 'declined', 'completed', 'cancelled'].includes(status)) throw new AdminActionError(400, 'Choose a valid campaign status.');
    const filter = { ...(forProvider ? { providerId: req.user!._id } : { studentId: req.user!._id, ...visibleCampaigns }), ...(status ? { status } : {}) };
    const [requests, total] = await Promise.all([PromotionRequest.find(filter).select('-history -submissions').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('studentId', creatorFields).populate('providerId', providerFields), PromotionRequest.countDocuments(filter)]);
    res.json({ success: true, data: { requests: requests.map(campaignView), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { failure(res, error); }
};
export const listMyPromotionRequests = listCampaigns(false);
export const listProviderPromotionRequests = listCampaigns(true);
export const getPromotionRequest = async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: { request: await campaignResponse(creatorId(req.params.id), req.user!) } }); }
  catch (error) { failure(res, error); }
};
const campaignChange = (mutation: CampaignMutation) => async (req: Request, res: Response): Promise<void> => {
  try {
    const id = await changeCampaign(creatorId(req.params.id), req.user!._id, mutation, req.body);
    res.json({ success: true, message: 'Campaign updated.', data: { request: await campaignResponse(id, req.user!) } });
  } catch (error) { failure(res, error); }
};
export const updatePromotionRequestStatus = campaignChange('status');
export const submitPromotionDeliverables = campaignChange('submission');
export const reviewPromotionDeliverables = campaignChange('review');
export const updatePromotionTerms = campaignChange('terms');
export const verifiedCreatorProviderOnly = verifyProvider;
