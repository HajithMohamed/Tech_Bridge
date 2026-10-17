import { Request, Response } from 'express';
import Application, { ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import { applicationPriority } from '../utils/priorityEngine';

const applicationStatuses: ApplicationStatus[] = ['applied', 'reviewed', 'accepted', 'rejected'];
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';

const currentAcademicYearStart = () => new Date(new Date().getFullYear(), 0, 1);
const idString = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return String(value);
};

const enrichApplications = async (applications: InstanceType<typeof Application>[], opportunity: InstanceType<typeof Opportunity>) => {
  if (!applications.length) return [];
  const studentIds = applications.map((application) => idString(application.studentId));
  const [students, acceptedBenefits] = await Promise.all([
    User.find({ _id: { $in: studentIds } }),
    Application.aggregate<{ _id: typeof studentIds[number]; count: number }>([
      { $match: { status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, studentId: { $in: studentIds } } },
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
  return applications.map((application) => ({
    ...application.toObject(),
    ...applicationPriority(application, opportunity, studentMap.get(idString(application.studentId)), benefitMap.get(idString(application.studentId)) || 0, firstAt, lastAt, acceptedCount),
  })).sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime());
};

/** POST /api/applications */
export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { opportunityId, message, justification, selfDeclaredNeed } = req.body;
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

    const application = await Application.create({
      studentId: req.user!._id,
      providerId: opportunity.providerId,
      opportunityId: opportunity._id,
      message: typeof message === 'string' ? message.trim() : undefined,
      justification: justification.trim(),
      selfDeclaredNeed,
    });
    await application.populate('opportunityId', opportunitySelect);

    res.status(201).json({
      success: true,
      message: 'Application submitted',
      data: { application },
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(400).json({ success: false, message: 'Unable to submit your application.' });
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

    const applications = await Application.find({ opportunityId: opportunity._id })
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
    const status = req.body.status as ApplicationStatus;
    if (!applicationStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be applied, reviewed, accepted, or rejected.' });
      return;
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' });
      return;
    }

    const opportunity = await Opportunity.findOne({ _id: application.opportunityId, providerId: req.user!._id });
    if (!opportunity) {
      res.status(403).json({ success: false, message: 'You cannot update this application.' });
      return;
    }

    if (status === 'accepted' && opportunity.type === 'scholarship') {
      const [acceptedForOpportunity, existingScholarships] = await Promise.all([
        Application.countDocuments({ opportunityId: opportunity._id, status: 'accepted', _id: { $ne: application._id } }),
        Application.find({ studentId: application.studentId, status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, _id: { $ne: application._id } }).populate('opportunityId', 'type'),
      ]);
      if (acceptedForOpportunity >= (opportunity.numberOfAwards || 1)) {
        res.status(409).json({ success: false, message: 'This scholarship has reached its number of awards.' });
        return;
      }
      if (existingScholarships.some((item) => (item.opportunityId as unknown as { type?: string })?.type === 'scholarship')) {
        res.status(409).json({ success: false, message: 'This student already holds an accepted scholarship for this academic year.' });
        return;
      }
    }

    application.status = status;
    await application.save();
    await application.populate('studentId', studentSelect);
    await application.populate('opportunityId', opportunitySelect);

    res.status(200).json({
      success: true,
      message: 'Application status updated',
      data: { application },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to update this application.' });
  }
};
/** GET /api/applications/provider */
export const listProviderApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await Application.find({ providerId: req.user!._id })
      .populate('studentId', studentSelect)
      .populate('opportunityId', opportunitySelect)
      .sort({ appliedAt: 1 });
    const opportunities = await Opportunity.find({ _id: { $in: applications.map((application) => idString(application.opportunityId)) } });
    const enriched = (await Promise.all(opportunities.map(async (opportunity) => {
      const group = applications.filter((application) => idString(application.opportunityId) === opportunity._id.toString());
      return enrichApplications(group as InstanceType<typeof Application>[], opportunity);
    }))).flat().sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    res.status(200).json({ success: true, data: { applications: enriched } });
  } catch (error) {
    console.error('List provider applications error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch applications.' });
  }
};
