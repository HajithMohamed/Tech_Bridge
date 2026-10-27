import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import PromotionRequest, { type PromotionCompensationType, type PromotionRequestStatus } from '../models/PromotionRequest';
import User, { type CreatorPlatform, type ICreatorProfile } from '../models/User';
import { AdminActionError } from '../services/adminUsers';
import { creatorAvailability, creatorCompensation, creatorId, creatorPage, creatorPlatforms, creatorProfileInput, creatorQueryText, creatorRevision, literalCreatorSearch, publicCreator } from '../services/creatorPolicy';

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
const compensationTypes: PromotionCompensationType[] = ['paid', 'product_exchange', 'experience', 'affiliate'];
const requestStudentFields = 'fullName';

/** POST /api/promotion-requests */
export const createPromotionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const studentId = body.studentId;
    const campaignBrief = typeof body.campaignBrief === 'string' ? body.campaignBrief.trim() : '';
    const deliverables = typeof body.deliverables === 'string' ? body.deliverables.trim() : '';
    const compensationType = body.compensationType as PromotionCompensationType;
    const compensationDetails = typeof body.compensationDetails === 'string' ? body.compensationDetails.trim() : '';
    const deadline = body.deadline ? new Date(String(body.deadline)) : undefined;
    if (!mongoose.isValidObjectId(studentId) || !campaignBrief || campaignBrief.length > 1000 || !deliverables || deliverables.length > 2000 || !compensationTypes.includes(compensationType) || compensationDetails.length > 1000 || (deadline && Number.isNaN(deadline.getTime()))) {
      res.status(400).json({ success: false, message: 'Provide a discoverable creator, campaign brief, deliverables, and compensation type.' }); return;
    }
    if (deadline && deadline.getTime() <= Date.now()) { res.status(400).json({ success: false, message: 'Campaign deadline must be in the future.' }); return; }
    const creator = await User.exists({ _id: studentId, role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true });
    if (!creator) { res.status(404).json({ success: false, message: 'This creator profile is not available.' }); return; }
    const request = await PromotionRequest.create({ studentId, providerId: req.user!._id, campaignBrief, deliverables, compensationType, ...(compensationDetails ? { compensationDetails } : {}), ...(deadline ? { deadline } : {}) });
    const populatedRequest = await PromotionRequest.findById(request._id)
      .populate('studentId', requestStudentFields)
      .populate('providerId', providerFields);
    res.status(201).json({ success: true, message: 'Promotion request sent.', data: { request: populatedRequest || request } });
  } catch (error) {
    console.error('Create promotion request error:', error);
    res.status(500).json({ success: false, message: 'Unable to send this promotion request.' });
  }
};

/** GET /api/promotion-requests/mine */
export const listMyPromotionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await PromotionRequest.find({ studentId: req.user!._id }).sort({ createdAt: -1 })
      .populate('studentId', requestStudentFields)
      .populate('providerId', providerFields);
    res.json({ success: true, data: { requests } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load promotion requests.' }); }
};

/** GET /api/promotion-requests/provider */
export const listProviderPromotionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await PromotionRequest.find({ providerId: req.user!._id }).sort({ createdAt: -1 })
      .populate('studentId', requestStudentFields)
      .populate('providerId', providerFields);
    res.json({ success: true, data: { requests } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load promotion requests.' }); }
};

/** PATCH /api/promotion-requests/:id/status */
export const updatePromotionRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid promotion request ID.' }); return; }
    const status = req.body.status as PromotionRequestStatus;
    const request = await PromotionRequest.findById(req.params.id);
    if (!request) { res.status(404).json({ success: false, message: 'Promotion request not found.' }); return; }
    const isStudent = req.user!.role === 'student' && request.studentId.equals(req.user!._id);
    const isProvider = req.user!.role === 'provider' && request.providerId.equals(req.user!._id) && req.user!.providerProfile?.verified;
    if (!isStudent && !isProvider) { res.status(403).json({ success: false, message: 'You cannot update this promotion request.' }); return; }
    if (isStudent && request.status === 'pending' && ['accepted', 'declined'].includes(status)) request.status = status;
    else if (isProvider && request.status === 'accepted' && status === 'completed') request.status = 'completed';
    else { res.status(400).json({ success: false, message: 'This status change is not allowed.' }); return; }
    await request.save();
    const populatedRequest = await PromotionRequest.findById(request._id)
      .populate('studentId', requestStudentFields)
      .populate('providerId', providerFields);
    res.json({ success: true, message: 'Promotion request updated.', data: { request: populatedRequest || request } });
  } catch { res.status(500).json({ success: false, message: 'Unable to update this promotion request.' }); }
};

export const verifiedCreatorProviderOnly = verifyProvider;
