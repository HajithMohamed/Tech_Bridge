import { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import mongoose, { Types } from 'mongoose';
import { submitOrdinaryApplication } from '../services/opportunityApplications';
import { ScholarshipReview } from '../models/Scholarship';
import { submitScholarship } from '../services/scholarships';
import { compareScholarshipCandidates, scholarshipId } from '../services/scholarshipPolicy';
import { applicationPriority } from '../utils/priorityEngine';
import { changeApplicationStatus, currentAcademicYearStart, ScholarshipAwardError } from '../services/scholarshipAwards';

const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';

const idString = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return String(value);
};

const enrichApplications = async (applications: InstanceType<typeof Application>[], opportunity: InstanceType<typeof Opportunity>) => {
  if (!applications.length) return [];
  const studentIds = applications.map((application) => idString(application.studentId)).filter((id) => /^[a-f\d]{24}$/i.test(id));
  const [students, acceptedBenefits] = await Promise.all([
    User.find({ _id: { $in: studentIds } }),
    Application.aggregate<{ _id: typeof studentIds[number]; count: number }>([
      { $match: { status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, studentId: { $in: studentIds.map((id) => new Types.ObjectId(id)) } } },
      { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opportunity' } },
      { $unwind: '$opportunity' },
      { $match: { 'opportunity.type': opportunity.type } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } },
    ]),
  ]);
  const studentMap = new Map(students.map((student) => [student._id.toString(), student]));
  const benefitMap = new Map(acceptedBenefits.map((item) => [item._id.toString(), item.count]));
  const dates = applications.map((application) => application.appliedAt.getTime());
  const firstAt = new Date(Math.min(...dates));
  const lastAt = new Date(Math.max(...dates));
  const acceptedCount = applications.filter((application) => application.status === 'accepted').length;
  const reviews = opportunity.type === 'scholarship' ? await ScholarshipReview.find({ applicationId: { $in: applications.map((application) => application._id) } }) : [];
  const reviewMap = new Map(reviews.map((review) => [String(review.applicationId), review]));
  return applications.map((application) => ({
    ...application.toObject(),
    ...applicationPriority(application, opportunity, studentMap.get(idString(application.studentId)), benefitMap.get(idString(application.studentId)) || 0, firstAt, lastAt, acceptedCount),
    ...(reviewMap.has(String(application._id)) ? { ...reviewMap.get(String(application._id))!.priority, policyRevision: reviewMap.get(String(application._id))!.policyRevision, isWaitlisted: application.status === 'waitlisted' } : application.status === 'waitlisted' ? { isWaitlisted: true } : {}),
  })).sort(compareScholarshipCandidates);
};

/** POST /api/applications */
export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { opportunityId, message, justification, selfDeclaredNeed } = req.body || {};
    scholarshipId(opportunityId);
    const opportunity = await Opportunity.findOne({ _id: opportunityId, status: 'open' });

    if (!opportunity || opportunity.applicationDeadline <= new Date()) {
      res.status(404).json({ success: false, message: 'This opportunity is no longer accepting applications.' });
      return;
    }

    const existing = await Application.findOne({ studentId: req.user!._id, opportunityId: opportunity._id });
    if (existing) {
      res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' });
      return;
    }
    if (typeof justification !== 'string' || justification.trim().length < 30 || justification.trim().length > 800) {
      res.status(400).json({ success: false, message: 'Please provide a justification between 30 and 800 characters.' });
      return;
    }
    if (!['low', 'medium', 'high'].includes(selfDeclaredNeed)) {
      res.status(400).json({ success: false, message: 'Select your declared need level.' });
      return;
    }

    const application = opportunity.type === 'scholarship' ? await submitScholarship(req.user!._id, req.body) : await submitOrdinaryApplication(req.user!._id, req.body);
    await application.populate('opportunityId', opportunitySelect);

    res.status(201).json({
      success: true,
      message: 'Application submitted',
      data: { application },
    });
  } catch (error) {
    if (error instanceof ScholarshipAwardError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) { res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' }); return; }
    res.status(error instanceof mongoose.Error.ValidationError ? 400 : 503).json({ success: false, message: 'Unable to submit your application.' });
  }
};

/** GET /api/applications/mine */
export const listMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await Application.find({ studentId: req.user!._id })
      .populate('opportunityId', opportunitySelect)
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (error) {
    console.error('List student applications error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch your applications.' });
  }
};

/** GET /api/applications/opportunity/:id */
export const listOpportunityApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, providerId: req.user!._id });
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it.' });
      return;
    }

    const applications = await Application.find({ opportunityId: opportunity._id, providerId: req.user!._id })
      .populate('studentId', studentSelect)
      .sort({ appliedAt: 1 });
    const enriched = await enrichApplications(applications as InstanceType<typeof Application>[], opportunity);
    res.status(200).json({ success: true, data: { applications: enriched } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to fetch applicants for this opportunity.' });
  }
};

/** PATCH /api/applications/:id/status */
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const application = await changeApplicationStatus(req.params.id, req.user!._id, req.body?.status, { reason: req.body?.reason, revision: req.body?.revision, priorityOverrideReason: req.body?.priorityOverrideReason });
    res.status(200).json({ success: true, message: 'Application status updated', data: { application } });
  } catch (error) {
    if (error instanceof ScholarshipAwardError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(503).json({ success: false, message: 'Unable to update this application. Please try again later.' });
  }
};
/** GET /api/applications/provider */
export const listProviderApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const owned = await Opportunity.find({ providerId: req.user!._id }).select('_id');
    const applications = await Application.find({ providerId: req.user!._id, opportunityId: { $in: owned.map((row) => row._id) } })
      .populate('studentId', studentSelect)
      .populate('opportunityId', opportunitySelect)
      .sort({ appliedAt: 1 });
    const opportunities = await Opportunity.find({ _id: { $in: applications.map((application) => idString(application.opportunityId)) }, providerId: req.user!._id });
    const enriched = (await Promise.all(opportunities.map(async (opportunity) => {
      const group = applications.filter((application) => idString(application.opportunityId) === opportunity._id.toString());
      return enrichApplications(group as InstanceType<typeof Application>[], opportunity);
    }))).flat().sort(compareScholarshipCandidates);
    res.status(200).json({ success: true, data: { applications: enriched } });
  } catch (error) {
    console.error('List provider applications error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch applications.' });
  }
};
