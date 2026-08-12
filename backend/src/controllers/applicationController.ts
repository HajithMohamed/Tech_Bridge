import { Request, Response } from 'express';
import Application, { ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';

const applicationStatuses: ApplicationStatus[] = ['applied', 'reviewed', 'accepted', 'rejected'];
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';

/** POST /api/applications */
export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { opportunityId, message } = req.body;
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

    const application = await Application.create({
      studentId: req.user!._id,
      providerId: opportunity.providerId,
      opportunityId: opportunity._id,
      message: typeof message === 'string' ? message.trim() : undefined,
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
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
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
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, data: { applications } });
  } catch (error) {
    console.error('List provider applications error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch applications.' });
  }
};
