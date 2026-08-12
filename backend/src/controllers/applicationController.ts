import { Request, Response } from 'express';
import Application, { ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';

const applicationStatuses: ApplicationStatus[] = ['submitted', 'reviewing', 'accepted', 'rejected'];
const applicantSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';

/** POST /api/opportunities/:id/applications */
export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, status: 'open' });
    if (!opportunity || opportunity.applicationDeadline <= new Date()) {
      res.status(404).json({ success: false, message: 'This opportunity is no longer accepting applications.' });
      return;
    }

    const existing = await Application.findOne({ opportunityId: opportunity._id, applicantId: req.user!._id });
    if (existing) {
      res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' });
      return;
    }

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : undefined;
    const application = await Application.create({ opportunityId: opportunity._id, applicantId: req.user!._id, message });
    await application.populate('opportunityId', opportunitySelect);
    res.status(201).json({ success: true, message: 'Application submitted', data: { application } });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(400).json({ success: false, message: 'Unable to submit your application.' });
  }
};

/** GET /api/opportunities/:id/applications */
export const listOpportunityApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, providerId: req.user!._id });
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it.' });
      return;
    }
    const applications = await Application.find({ opportunityId: opportunity._id })
      .populate('applicantId', applicantSelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to fetch applications.' });
  }
};

/** GET /api/applications/provider */
export const listProviderApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunities = await Opportunity.find({ providerId: req.user!._id }).select('_id');
    const opportunityIds = opportunities.map((opportunity) => opportunity._id);
    const status = typeof req.query.status === 'string' && applicationStatuses.includes(req.query.status as ApplicationStatus)
      ? req.query.status
      : undefined;
    const applications = await Application.find({
      opportunityId: { $in: opportunityIds },
      ...(status ? { status } : {}),
    })
      .populate('applicantId', applicantSelect)
      .populate('opportunityId', opportunitySelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (error) {
    console.error('List provider applications error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch provider applications.' });
  }
};

/** GET /api/applications/mine */
export const listMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await Application.find({ applicantId: req.user!._id })
      .populate('opportunityId', opportunitySelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch your applications.' });
  }
};

/** PATCH /api/applications/:id/status */
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.body.status as ApplicationStatus;
    if (!applicationStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Select a valid application status.' });
      return;
    }
    const application = await Application.findById(req.params.id);
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' });
      return;
    }
    const opportunity = await Opportunity.findOne({ _id: application.opportunityId, providerId: req.user!._id });
    if (!opportunity) {
      res.status(403).json({ success: false, message: 'You cannot manage this application.' });
      return;
    }
    application.status = status;
    await application.save();
    await application.populate('applicantId', applicantSelect);
    await application.populate('opportunityId', opportunitySelect);
    res.status(200).json({ success: true, message: 'Application status updated', data: { application } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to update this application.' });
  }
};
