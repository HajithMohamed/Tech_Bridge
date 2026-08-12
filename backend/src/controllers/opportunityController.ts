import { Request, Response } from 'express';
import Opportunity, { IOpportunity, OpportunityType } from '../models/Opportunity';
import Application from '../models/Application';

const opportunityTypes: OpportunityType[] = [
  'job',
  'internship',
  'scholarship',
  'course',
  'freelance',
  'workshop',
];
const workModes = ['remote', 'on-site', 'hybrid'];
const coverageTypes = ['full', 'partial', 'tuition_only', 'equipment_only', 'stipend'];
const opportunityStatuses = ['draft', 'open', 'closed', 'expired'];
const editableFields = [
  'title',
  'description',
  'type',
  'requiredSkills',
  'location',
  'workMode',
  'status',
  'applicationDeadline',
  'amount',
  'currency',
  'coverageType',
  'eligibilityCriteria',
  'numberOfAwards',
  'renewable',
] as const;
const scholarshipFields = ['amount', 'currency', 'coverageType', 'eligibilityCriteria', 'numberOfAwards', 'renewable'] as const;

const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified';

const isScholarshipProvider = (req: Request): boolean => {
  const type = req.user?.providerProfile?.organizationType;
  return type === 'scholarship_org' || type === 'ngo';
};

const hasValidDeadline = (deadline: unknown): boolean => {
  const parsed = new Date(String(deadline));
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
};

const expireOpportunities = async (): Promise<void> => {
  await Opportunity.updateMany(
    { status: 'open', applicationDeadline: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

const validateOpportunity = (values: Record<string, unknown>): string | null => {
  if (typeof values.title !== 'string' || values.title.trim().length < 3) return 'Title must be at least 3 characters.';
  if (typeof values.description !== 'string' || values.description.trim().length < 20) return 'Description must be at least 20 characters.';
  if (!opportunityTypes.includes(values.type as OpportunityType)) return 'Select a valid opportunity type.';
  if (!Array.isArray(values.requiredSkills)) return 'requiredSkills must be an array.';
  if (typeof values.location !== 'string' || !values.location.trim()) return 'Location is required.';
  if (!workModes.includes(values.workMode as string)) return 'Select a valid work mode.';
  if (!opportunityStatuses.includes(values.status as string)) return 'Select a valid opportunity status.';
  if (!hasValidDeadline(values.applicationDeadline)) return 'Application deadline must be a future date.';

  if (values.type === 'scholarship') {
    if (typeof values.amount !== 'number' || values.amount < 0) return 'Scholarships require a valid amount.';
    if (typeof values.currency !== 'string' || !values.currency.trim()) return 'Scholarships require a currency.';
    if (!coverageTypes.includes(values.coverageType as string)) return 'Scholarships require a valid coverage type.';
    if (!Array.isArray(values.eligibilityCriteria) || values.eligibilityCriteria.length === 0 || values.eligibilityCriteria.some(item => typeof item !== 'string' || !item.trim())) return 'Scholarships require at least one eligibility criterion.';
    if (!Number.isInteger(values.numberOfAwards) || (values.numberOfAwards as number) < 1) return 'Scholarships require at least one award.';
    if (typeof values.renewable !== 'boolean') return 'Scholarships must state whether the award is renewable.';
  }

  return null;
};

const opportunityPayload = (body: Record<string, unknown>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  editableFields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  return payload;
};

/** POST /api/opportunities */
export const createOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = opportunityPayload(req.body);
    const validationError = validateOpportunity(payload);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }
    if (payload.type === 'scholarship' && !isScholarshipProvider(req)) {
      res.status(403).json({
        success: false,
        message: 'Only verified scholarship organizations and NGOs can publish scholarships.',
      });
      return;
    }

    const opportunity = await Opportunity.create({ ...payload, providerId: req.user!._id });
    await opportunity.populate('providerId', providerSelect);
    res.status(201).json({ success: true, message: 'Opportunity created', data: { opportunity } });
  } catch (error) {
    console.error('Create opportunity error:', error);
    res.status(500).json({ success: false, message: 'Server error creating opportunity' });
  }
};

/** GET /api/opportunities */
export const listOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    await expireOpportunities();
    const { type, skill, workMode } = req.query;
    const filter: Record<string, unknown> = { status: 'open' };

    if (typeof type === 'string' && opportunityTypes.includes(type as OpportunityType)) filter.type = type;
    if (typeof workMode === 'string' && workModes.includes(workMode)) filter.workMode = workMode;
    if (typeof skill === 'string' && skill.trim()) {
      const escaped = skill.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.requiredSkills = { $regex: escaped, $options: 'i' };
    }

    const opportunities = await Opportunity.find(filter)
      .populate('providerId', providerSelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { opportunities } });
  } catch (error) {
    console.error('List opportunities error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching opportunities' });
  }
};

/** GET /api/opportunities/scholarships */
export const listScholarships = async (_req: Request, res: Response): Promise<void> => {
  try {
    await expireOpportunities();
    const opportunities = await Opportunity.find({ status: 'open', type: 'scholarship' })
      .populate('providerId', providerSelect)
      .sort({ applicationDeadline: 1 });
    res.status(200).json({ success: true, data: { opportunities } });
  } catch (error) {
    console.error('List scholarships error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching scholarships' });
  }
};

/** GET /api/opportunities/mine */
export const listMyOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    await expireOpportunities();
    const opportunities = await Opportunity.find({ providerId: req.user!._id }).sort({ createdAt: -1 });
    const enriched = await Promise.all(opportunities.map(async (opportunity) => ({
      ...opportunity.toObject(),
      applicationCount: await Application.countDocuments({ opportunityId: opportunity._id }),
    })));
    res.status(200).json({ success: true, data: { opportunities: enriched } });
  } catch (error) {
    console.error('List provider opportunities error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching your opportunities' });
  }
};

/** GET /api/opportunities/:id */
export const getOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    await expireOpportunities();
    const opportunity = await Opportunity.findOneAndUpdate({ _id: req.params.id, status: 'open' }, { $inc: { views: 1 } }, { new: true })
      .populate('providerId', providerSelect);
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Open opportunity not found' });
      return;
    }
    res.status(200).json({ success: true, data: { opportunity } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid opportunity ID' });
  }
};

/** PUT /api/opportunities/:id */
export const updateOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, providerId: req.user!._id });
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
      return;
    }

    const payload = opportunityPayload(req.body);
    const values = { ...opportunity.toObject(), ...payload } as Record<string, unknown>;
    const validationError = validateOpportunity(values);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }
    if (values.type === 'scholarship' && !isScholarshipProvider(req)) {
      res.status(403).json({
        success: false,
        message: 'Only verified scholarship organizations and NGOs can publish scholarships.',
      });
      return;
    }

    if (payload.status === 'expired') {
      res.status(400).json({ success: false, message: 'Expired status is assigned automatically when a deadline passes.' });
      return;
    }
    opportunity.set(payload);
    if (opportunity.type !== 'scholarship') {
      scholarshipFields.forEach((field) => opportunity.set(field, undefined));
    }
    await opportunity.save();
    await opportunity.populate('providerId', providerSelect);
    res.status(200).json({ success: true, message: 'Opportunity updated', data: { opportunity } });
  } catch (error) {
    console.error('Update opportunity error:', error);
    res.status(400).json({ success: false, message: 'Unable to update this opportunity' });
  }
};

/** DELETE /api/opportunities/:id */
export const deleteOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await Opportunity.findOneAndDelete({ _id: req.params.id, providerId: req.user!._id });
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
      return;
    }
    res.status(200).json({ success: true, message: 'Opportunity deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid opportunity ID' });
  }
};
