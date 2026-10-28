import type { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import { ScholarshipAppeal, ScholarshipEvent, ScholarshipEvidence, ScholarshipReview } from '../models/Scholarship';
import { AdminActionError } from '../services/adminUsers';
import { creatorPage } from '../services/creatorPolicy';
import { changeApplicationStatus, scholarshipCapacity } from '../services/scholarshipAwards';
import { ScholarshipError, scholarshipEligibility, scholarshipId, scholarshipReason, scholarshipRevision } from '../services/scholarshipPolicy';
import { configureScholarship, policyFor, readScholarshipEvidence, recalculateScholarshipPriority, reviewScholarshipAppeal, scholarshipContext, submitScholarshipAppeal, uploadScholarshipEvidence } from '../services/scholarships';

const failure = (res: Response, error: unknown) => {
  if (error instanceof ScholarshipError || error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) { res.status(409).json({ success: false, message: 'This scholarship action has already been recorded.' }); return; }
  res.status(503).json({ success: false, message: 'Scholarship services are temporarily unavailable.' });
};
const body = (req: Request): Record<string, unknown> => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ScholarshipError(400, 'Provide a scholarship request object.');
  return req.body;
};
const role = (req: Request) => req.user!.role as 'student' | 'provider';
const pagination = (req: Request) => ({ page: creatorPage(req.query.page), limit: creatorPage(req.query.limit, 20, 50) });
async function ownedScholarship(req: Request) {
  const opportunity = await Opportunity.findOne({ _id: scholarshipId(req.params.id), providerId: req.user!._id, type: 'scholarship' });
  if (!opportunity) throw new ScholarshipError(404, 'Scholarship not found.'); return opportunity;
}
export const getScholarshipPolicy = async (req: Request, res: Response) => {
  try {
    const opportunity = await Opportunity.findOne({ _id: scholarshipId(req.params.id), type: 'scholarship', ...(role(req) === 'provider' ? { providerId: req.user!._id } : { status: 'open', applicationDeadline: { $gt: new Date() } }) });
    if (!opportunity) throw new ScholarshipError(404, 'Scholarship policy not found.');
    const policy = await policyFor(opportunity._id); const frozen = Boolean(await Application.exists({ opportunityId: opportunity._id }));
    const strictDecisions = policy.revision > 0;
    res.json({ success: true, data: { ...policy, frozen, strictDecisions, ...(role(req) === 'student' ? { eligibility: scholarshipEligibility(req.user, policy.settings) } : {}) } });
  } catch (error) { failure(res, error); }
};
export const updateScholarshipPolicy = async (req: Request, res: Response) => {
  try { const policy = await configureScholarship(req.params.id, req.user!._id, body(req)); res.json({ success: true, data: { policy } }); } catch (error) { failure(res, error); }
};
export const getScholarshipAssessment = async (req: Request, res: Response) => {
  try {
    const { application, opportunity } = await scholarshipContext(req.params.id, req.user!._id, role(req));
    const review = await ScholarshipReview.findOne({ applicationId: application._id }); const fallback = review ? undefined : await policyFor(opportunity._id); const policy = review?.policy ?? fallback!.settings;
    const [student, evidenceCount, appealPending] = await Promise.all([User.findById(application.studentId), ScholarshipEvidence.countDocuments({ applicationId: application._id }), ScholarshipAppeal.exists({ applicationId: application._id, status: 'pending' })]);
    res.json({ success: true, data: { applicationId: application._id, status: application.status, revision: application.scholarshipRevision ?? 0, strictDecisions: application.scholarshipVersion === 1 || (review?.policyRevision ?? fallback?.revision ?? 0) > 0, waitlistedAt: application.waitlistedAt, awardedAt: application.awardedAt, withdrawnByAdmin: opportunity.scholarshipWithdrawnByAdmin === true, assessment: review ? { policy: review.policy, policyRevision: review.policyRevision, priority: review.priority, calculatedAt: review.calculatedAt, decisionReason: review.decisionReason, priorityOverrideReason: review.priorityOverrideReason } : null, eligibility: scholarshipEligibility(student ?? undefined, policy), evidenceRequired: policy.eligibility.requireEvidence, evidenceCount, appealPending: Boolean(appealPending) } });
  } catch (error) { failure(res, error); }
};
export const scholarshipHistory = (policyOnly = false) => async (req: Request, res: Response) => {
  try {
    const { page, limit } = pagination(req); const filter = policyOnly ? { opportunityId: (await ownedScholarship(req))._id, action: 'policy_updated' } : { applicationId: (await scholarshipContext(req.params.id, req.user!._id, role(req))).application._id };
    const [events, total] = await Promise.all([ScholarshipEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), ScholarshipEvent.countDocuments(filter)]);
    res.json({ success: true, data: { events, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { failure(res, error); }
};
export const listScholarshipEvidence = async (req: Request, res: Response) => {
  try { const { application } = await scholarshipContext(req.params.id, req.user!._id, role(req)); const documents = await ScholarshipEvidence.find({ applicationId: application._id }).select('_id fileName contentType size createdAt').sort({ createdAt: 1, _id: 1 }); res.json({ success: true, data: { documents } }); } catch (error) { failure(res, error); }
};
export const addScholarshipEvidence = async (req: Request, res: Response) => {
  try { const document = await uploadScholarshipEvidence(req.params.id, req.user!._id, body(req)); res.status(201).json({ success: true, data: { document } }); } catch (error) { failure(res, error); }
};
export const downloadScholarshipEvidence = (providerAccess = false) => async (req: Request, res: Response) => {
  try {
    const document = await readScholarshipEvidence(req.params.id, req.params.documentId, req.user!._id, providerAccess ? 'provider' : 'student', providerAccess ? body(req).reason : undefined);
    const extension = document.contentType === 'application/pdf' ? 'pdf' : document.contentType === 'image/png' ? 'png' : 'jpg';
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="scholarship-evidence.${extension}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(document.data);
  } catch (error) { failure(res, error); }
};
export const createScholarshipAppeal = async (req: Request, res: Response) => {
  try { const appeal = await submitScholarshipAppeal(req.params.id, req.user!._id, body(req)); res.status(201).json({ success: true, data: { appeal } }); } catch (error) { failure(res, error); }
};
export const listScholarshipAppeals = async (req: Request, res: Response) => {
  try { const { application } = await scholarshipContext(req.params.id, req.user!._id, role(req)); const appeals = await ScholarshipAppeal.find({ applicationId: application._id }).sort({ createdAt: -1, _id: -1 }); res.json({ success: true, data: { appeals } }); } catch (error) { failure(res, error); }
};
export const decideScholarshipAppeal = async (req: Request, res: Response) => {
  try { const appeal = await reviewScholarshipAppeal(req.params.id, req.params.appealId, req.user!._id, body(req)); res.json({ success: true, data: { appeal } }); } catch (error) { failure(res, error); }
};
export const refreshScholarshipPriority = async (req: Request, res: Response) => {
  try { const assessment = await recalculateScholarshipPriority(req.params.id, req.user!._id, body(req).reason); res.json({ success: true, data: { assessment } }); } catch (error) { failure(res, error); }
};
export const listScholarshipWaitlist = async (req: Request, res: Response) => {
  try {
    const opportunity = await ownedScholarship(req); const { page, limit } = pagination(req); const filter = { opportunityId: opportunity._id, status: 'waitlisted' };
    const [ranked, total, accepted] = await Promise.all([
      Application.aggregate([{ $match: filter }, { $lookup: { from: ScholarshipReview.collection.name, localField: '_id', foreignField: 'applicationId', as: 'review' } }, { $set: { priorityScore: { $ifNull: [{ $arrayElemAt: ['$review.priority.priorityScore', 0] }, 0] } } }, { $sort: { priorityScore: -1, appliedAt: 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { _id: 1, priorityScore: 1 } }]),
      Application.countDocuments(filter), Application.countDocuments({ opportunityId: opportunity._id, status: 'accepted' }),
    ]);
    const rows = await Application.find({ _id: { $in: ranked.map((row) => row._id) } }).populate('studentId', 'fullName studentProfile.institution studentProfile.degree studentProfile.studyYear');
    const reviews = await ScholarshipReview.find({ applicationId: { $in: ranked.map((row) => row._id) } }); const byId = new Map(rows.map((row) => [String(row._id), row])); const byReview = new Map(reviews.map((review) => [String(review.applicationId), review]));
    const applications = ranked.map((row) => ({ ...byId.get(String(row._id))?.toObject(), priorityScore: byReview.get(String(row._id))?.priority.priorityScore ?? null, priorityReasons: byReview.get(String(row._id))?.priority.priorityReasons ?? ['No persisted priority assessment; a reasoned recalculation is required.'] }));
    const capacity = scholarshipCapacity(opportunity.numberOfAwards); res.json({ success: true, data: { applications, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), capacity, accepted, remaining: Math.max(0, capacity - accepted), allocationBlocked: opportunity.scholarshipWithdrawnByAdmin === true } });
  } catch (error) { failure(res, error); }
};
export const advanceScholarshipWaitlist = async (req: Request, res: Response) => {
  try {
    const values = body(req); const id = scholarshipId(values.applicationId); const opportunityId = scholarshipId(req.params.id); scholarshipReason(values.reason); scholarshipRevision(values.revision, true);
    const application = await changeApplicationStatus(id, req.user!._id, 'accepted', { reason: values.reason, revision: values.revision, priorityOverrideReason: values.priorityOverrideReason, requireWaitlisted: true, opportunityId });
    res.json({ success: true, message: 'Explicit human waitlist decision recorded.', data: { application } });
  } catch (error) { failure(res, error); }
};
