import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import PromotionRequest from '../models/PromotionRequest';
import User, { type CreatorPlatform, type IUser } from '../models/User';
import { AdminActionError } from '../services/adminUsers';
import { creatorAvailability, creatorCompensation, creatorId, creatorPage, creatorPlatforms, creatorProfileInput, creatorQueryText, literalCreatorSearch } from '../services/creatorPolicy';
import { changeCampaign, createCampaign, type CampaignMutation } from '../services/creatorCampaigns';

const providerFields = 'fullName providerProfile.organizationName providerProfile.organizationType providerProfile.verified';
const creatorFields = 'fullName studentProfile.creatorProfile';
function failure(res: Response, error: unknown) {
  res.status(error instanceof AdminActionError ? error.statusCode : 503).json({ success: false, message: error instanceof AdminActionError ? error.message : 'Creator services are temporarily unavailable. Please try again.' });
}
const verifyProvider = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.providerProfile?.verified || req.user.providerProfile.verificationStatus !== 'VERIFIED') {
    res.status(403).json({ success: false, message: 'Only verified providers can access the creator marketplace.' }); return;
  }
  next();
};
function creatorSummary(student: IUser) {
  const profile = student.studentProfile?.creatorProfile;
  return { _id: student._id, fullName: profile?.displayName || student.fullName, studentProfile: { creatorProfile: profile } };
}
async function campaignResponse(id: mongoose.Types.ObjectId) {
  const row = await PromotionRequest.findById(id).populate('studentId', 'fullName studentProfile.creatorProfile.displayName').populate('providerId', providerFields);
  if (!row) throw new AdminActionError(404, 'Campaign request not found.');
  return row;
}
export const updateCreatorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = creatorProfileInput(req.body);
    const student = await mongoose.connection.transaction(async (session) => {
      const owner = await User.findOneAndUpdate({ _id: req.user!._id, role: 'student', accountStatus: 'active' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
      if (!owner?.studentProfile) throw new AdminActionError(404, 'Student profile not found.');
      owner.studentProfile.creatorProfile = profile;
      owner.markModified('studentProfile.creatorProfile');
      await owner.save({ session });
      return owner;
    });
    res.json({ success: true, message: profile.isDiscoverable ? 'Your creator profile is visible to verified providers.' : 'Your creator profile is hidden from providers.', data: { user: student } });
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
    res.json({ success: true, data: { creators: students.map(creatorSummary), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { failure(res, error); }
};
export const getCreator = async (req: Request, res: Response): Promise<void> => {
  try {
    const creator = await User.findOne({ _id: creatorId(req.params.studentId), role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true }).select(creatorFields);
    if (!creator) throw new AdminActionError(404, 'Creator profile not found.');
    res.json({ success: true, data: { creator: creatorSummary(creator) } });
  } catch (error) { failure(res, error); }
};
export const createPromotionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = await createCampaign(req.user!._id, req.body);
    res.status(201).json({ success: true, message: 'Promotion request sent.', data: { request: await campaignResponse(id) } });
  } catch (error) { failure(res, error); }
};
export const listMyPromotionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await PromotionRequest.find({ studentId: req.user!._id }).sort({ createdAt: -1, _id: -1 }).populate('studentId', 'fullName studentProfile.creatorProfile.displayName').populate('providerId', providerFields);
    res.json({ success: true, data: { requests } });
  } catch (error) { failure(res, error); }
};
export const listProviderPromotionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await PromotionRequest.find({ providerId: req.user!._id }).sort({ createdAt: -1, _id: -1 }).populate('studentId', 'fullName studentProfile.creatorProfile.displayName').populate('providerId', providerFields);
    res.json({ success: true, data: { requests } });
  } catch (error) { failure(res, error); }
};
const campaignChange = (mutation: CampaignMutation) => async (req: Request, res: Response): Promise<void> => {
  try {
    const id = await changeCampaign(creatorId(req.params.id), req.user!._id, mutation, req.body);
    res.json({ success: true, message: 'Campaign updated.', data: { request: await campaignResponse(id) } });
  } catch (error) { failure(res, error); }
};
export const updatePromotionRequestStatus = campaignChange('status');
export const submitPromotionDeliverables = campaignChange('submission');
export const reviewPromotionDeliverables = campaignChange('review');
export const verifiedCreatorProviderOnly = verifyProvider;
