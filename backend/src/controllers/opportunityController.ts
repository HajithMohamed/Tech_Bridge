import { editOpportunityWithAwardGuard, ScholarshipAwardError } from '../services/scholarshipAwards';
import mongoose, { Types } from 'mongoose';
import { publicListingProviderSelect } from '../utils/publicProvider';
import { Request, Response } from 'express';
import Opportunity, { OpportunityType } from '../models/Opportunity';
import Application from '../models/Application';
import { isProviderOfferingAllowed } from '../utils/providerCapabilities';
import { removeScholarshipAwareListing } from '../services/scholarships';
import type { IUser } from '../models/User';
import { discoverOpportunities, visibleOpportunity } from '../services/opportunityDiscovery';
import { effectiveOpportunityStatus, eligibilityInput, opportunityDate, opportunityObject, opportunitySearch, opportunityText, opportunityTypes } from '../services/opportunityPolicy';
import { lockScholarshipActor } from '../services/scholarships';

const workModes = ['remote', 'on-site', 'hybrid'];
const coverageTypes = ['full', 'partial', 'tuition_only', 'equipment_only', 'stipend'];
const opportunityStatuses = ['draft', 'open', 'closed', 'expired'];
const mentorshipTypes = ['Career guidance', 'Technical guidance', 'Internship guidance', 'Portfolio guidance'];
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
  'duration',
  'isPaid',
  'preferredAcademicBackground',
  'startDate',
  'endDate',
  'fee',
  'isFree',
  'mentorName',
  'professionalField',
  'experience',
  'mentorshipType',
  'availability',
  'paymentInfo',
  'contactMethod',
  'eligibility'
] as const;
const scholarshipFields = ['amount', 'currency', 'coverageType', 'eligibilityCriteria', 'numberOfAwards', 'renewable'] as const;

const providerSelect = publicListingProviderSelect;

const typeOffer: Record<OpportunityType, string> = {
  job: 'jobs',
  freelance: 'jobs',
  promotion: 'jobs',
  internship: 'internships',
  scholarship: 'scholarships',
  course: 'training',
  workshop: 'training',
  mentorship: 'mentorship',
};

const canOfferType = (user: Pick<IUser, 'providerProfile'> | undefined, type: OpportunityType): boolean => {
  const profile = user?.providerProfile;
  const selectedOffers = profile?.opportunityCategories || [];
  if (!selectedOffers.includes(typeOffer[type])) return false;
  return Boolean(profile && isProviderOfferingAllowed(profile.organizationType, typeOffer[type]));
};

const hasValidDeadline = (deadline: unknown): boolean => {
  try { return opportunityDate(deadline).getTime() > Date.now(); } catch { return false; }
};

const validateOpportunity = (values: Record<string, unknown>): string | null => {
  if (typeof values.title !== 'string' || values.title.trim().length < 3) return 'Title must be at least 3 characters.';
  if (typeof values.description !== 'string' || values.description.trim().length < 20) return 'Description must be at least 20 characters.';
  if (!opportunityTypes.includes(values.type as OpportunityType)) return 'Select a valid opportunity type.';
  if (!Array.isArray(values.requiredSkills)) return 'requiredSkills must be an array.';
  if (typeof values.location !== 'string' || !values.location.trim()) return 'Location is required.';
  if (!workModes.includes(values.workMode as string)) return 'Select a valid work mode.';
  if (!opportunityStatuses.includes(values.status as string)) return 'Select a valid opportunity status.';
  try { opportunityDate(values.applicationDeadline); } catch { return 'Enter a valid calendar deadline or explicit UTC timestamp.'; }
  if (['draft', 'open'].includes(values.status as string) && !hasValidDeadline(values.applicationDeadline)) return 'Application deadline must be a future date.';
  try {
    opportunityText(values.title, 3, 160); opportunityText(values.description, 20, 5000); opportunityText(values.location, 1, 120);
    if ((values.requiredSkills as unknown[]).length > 40) return 'Provide up to 40 preferred skills.';
    (values.requiredSkills as unknown[]).forEach(skill => opportunityText(skill, 1, 60));
    if (values.eligibility !== undefined) { if (values.type === 'scholarship') return 'Configure scholarship eligibility through the existing scholarship policy API.'; eligibilityInput(values.eligibility); }
    for (const field of ['startDate', 'endDate']) if (values[field] !== undefined) opportunityDate(values[field]);
  } catch (error) { return error instanceof Error ? error.message : 'Invalid opportunity fields.'; }

  if (values.type === 'scholarship') {
    if (typeof values.amount !== 'number' || values.amount < 0) return 'Scholarships require a valid amount.';
    if (typeof values.currency !== 'string' || !values.currency.trim()) return 'Scholarships require a currency.';
    if (!coverageTypes.includes(values.coverageType as string)) return 'Scholarships require a valid coverage type.';
    if (!Array.isArray(values.eligibilityCriteria) || values.eligibilityCriteria.length === 0 || values.eligibilityCriteria.some(item => typeof item !== 'string' || !item.trim())) return 'Scholarships require at least one eligibility criterion.';
    if (!Number.isInteger(values.numberOfAwards) || (values.numberOfAwards as number) < 1) return 'Scholarships require at least one award.';
    if (typeof values.renewable !== 'boolean') return 'Scholarships must state whether the award is renewable.';
  }

  if (values.type === 'job' || values.type === 'freelance' || values.type === 'promotion') {
    if (typeof values.paymentInfo !== 'string' || !values.paymentInfo.trim()) return 'Add payment, budget, or salary information.';
  }
  if (values.type === 'internship') {
    if (typeof values.duration !== 'string' || !values.duration.trim()) return 'Internships require a duration.';
    if (typeof values.isPaid !== 'boolean') return 'State whether the internship is paid.';
    if (typeof values.preferredAcademicBackground !== 'string' || !values.preferredAcademicBackground.trim()) return 'Add the preferred academic background.';
    if (values.startDate !== undefined && Number.isNaN(new Date(String(values.startDate)).getTime())) return 'Enter a valid internship start date.';
  }
  if (values.type === 'course' || values.type === 'workshop') {
    if (typeof values.duration !== 'string' || !values.duration.trim()) return 'Courses and workshops require a duration.';
    if (typeof values.isFree !== 'boolean') return 'State whether this learning opportunity is free.';
    if (values.isFree === false && (typeof values.fee !== 'number' || values.fee < 0)) return 'Enter a valid fee for this learning opportunity.';
    if (values.startDate !== undefined && Number.isNaN(new Date(String(values.startDate)).getTime())) return 'Enter a valid start date.';
    if (values.endDate !== undefined && Number.isNaN(new Date(String(values.endDate)).getTime())) return 'Enter a valid end date.';
    if (values.startDate && values.endDate && new Date(String(values.endDate)) < new Date(String(values.startDate))) return 'End date must be after the start date.';
  }
  if (values.type === 'mentorship') {
    if (typeof values.mentorName !== 'string' || !values.mentorName.trim()) return 'Mentorship listings require a mentor name.';
    if (typeof values.professionalField !== 'string' || !values.professionalField.trim()) return 'Mentorship listings require a professional field.';
    if (!mentorshipTypes.includes(values.mentorshipType as string)) return 'Select a valid mentorship focus.';
    if (typeof values.availability !== 'string' || !values.availability.trim()) return 'Add mentor availability.';
  }

  return null;
};

const opportunityPayload = (body: Record<string, unknown>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  editableFields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  if (payload.eligibility !== undefined) payload.eligibility = eligibilityInput(payload.eligibility);
  for (const field of ['applicationDeadline', 'startDate', 'endDate']) if (payload[field] !== undefined) payload[field] = opportunityDate(payload[field]);
  return payload;
};

/** POST /api/opportunities */
export const createOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ScholarshipAwardError(400, 'Provide an opportunity object.');
    const payload = opportunityPayload(req.body);
    const validationError = validateOpportunity(payload);
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }
    if (!canOfferType(req.user, payload.type as OpportunityType)) {
      res.status(403).json({
        success: false,
        message: 'This opportunity type is not enabled in your provider services. Update your organization offerings before publishing it.',
      });
      return;
    }

    if (payload.status === 'expired') throw new ScholarshipAwardError(400, 'Expiration is derived from the deadline.');
    const opportunity = await mongoose.connection.transaction(async session => {
      const provider = await lockScholarshipActor(req.user!._id, 'provider', session);
      if (provider.requiresEmailVerification && !provider.emailVerifiedAt) throw new ScholarshipAwardError(403, 'Verify your email before publishing opportunities.');
      if (!canOfferType(provider, payload.type as OpportunityType)) throw new ScholarshipAwardError(403, 'This opportunity type is not enabled in your current provider services.');
      const [created] = await Opportunity.create([{ ...payload, providerId: provider._id, revision: 0 }], { session }); return created;
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
    await opportunity.populate('providerId', providerSelect);
    res.status(201).json({ success: true, message: 'Opportunity created', data: { opportunity } });
  } catch (error) {
    if (error instanceof ScholarshipAwardError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    res.status(error instanceof mongoose.Error.ValidationError ? 400 : 503).json({ success: false, message: 'Unable to create this opportunity.' });
  }
};

/** GET /api/opportunities */
export const listOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await discoverOpportunities(req.query) });
  } catch (error) {
    res.status(error instanceof ScholarshipAwardError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipAwardError ? error.message : 'Unable to fetch opportunities.' });
  }
};

/** GET /api/opportunities/scholarships */
export const listScholarships = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.query.type !== undefined && req.query.type !== 'scholarship') throw new ScholarshipAwardError(400, 'This endpoint lists scholarships.');
    res.status(200).json({ success: true, data: await discoverOpportunities({ ...req.query, type: 'scholarship', sort: req.query.sort ?? 'deadline' }) });
  } catch (error) {
    res.status(error instanceof ScholarshipAwardError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipAwardError ? error.message : 'Unable to fetch scholarships.' });
  }
};

/** GET /api/opportunities/mine */
export const listMyOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = opportunityObject(req.query, ['page', 'limit', 'status', 'type', 'q']);
    const { filter, page, limit, sort } = opportunitySearch({ page: query.page, limit: query.limit, type: query.type, q: query.q });
    delete filter.status; delete filter.applicationDeadline; delete filter.scholarshipWithdrawnByAdmin; delete filter.opportunityWithdrawnByAdmin; filter.providerId = req.user!._id;
    if (query.status !== undefined) {
      if (!opportunityStatuses.includes(query.status as string)) throw new ScholarshipAwardError(400, 'Choose a valid opportunity status.');
      if (query.status === 'expired') filter.$and = [{ $or: [{ status: 'expired' }, { status: 'open', applicationDeadline: { $lte: new Date() } }] }];
      else { filter.status = query.status; if (query.status === 'open') filter.applicationDeadline = { $gt: new Date() }; }
    }
    const [opportunities, total] = await Promise.all([Opportunity.find(filter).sort(sort).skip((page - 1) * limit).limit(limit), Opportunity.countDocuments(filter)]);
    const counts = await Application.aggregate([{ $match: { opportunityId: { $in: opportunities.map(row => row._id) } } }, { $group: { _id: '$opportunityId', count: { $sum: 1 } } }]);
    const byId = new Map(counts.map(row => [String(row._id), row.count]));
    const enriched = opportunities.map(opportunity => ({ ...opportunity.toObject(), status: effectiveOpportunityStatus(opportunity), applicationCount: byId.get(String(opportunity._id)) ?? 0 }));
    res.status(200).json({ success: true, data: { opportunities: enriched, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(error instanceof ScholarshipAwardError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipAwardError ? error.message : 'Unable to fetch your opportunities.' });
  }
};

/** GET /api/opportunities/:id */
export const getOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunity = await visibleOpportunity(req.params.id);
    const updated = await Opportunity.updateOne({ _id: opportunity._id, status: 'open', applicationDeadline: { $gt: new Date() } }, { $inc: { views: 1 } });
    if (!updated.matchedCount) {
      res.status(404).json({ success: false, message: 'Open opportunity not found' });
      return;
    }
    opportunity.views += 1;
    res.status(200).json({ success: true, data: { opportunity } });
  } catch (error) {
    res.status(error instanceof ScholarshipAwardError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipAwardError ? error.message : 'Unable to fetch this opportunity.' });
  }
};

/** PUT /api/opportunities/:id */
export const updateOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (typeof req.params.id !== 'string' || !Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid opportunity ID.' });
      return;
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ success: false, message: 'Provide an opportunity update object.' });
      return;
    }
    const opportunity = await Opportunity.findOne({ _id: req.params.id, providerId: req.user!._id });
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
      return;
    }

    const payload = opportunityPayload(req.body);
    const updated = await editOpportunityWithAwardGuard(opportunity._id, req.user!._id, (current, provider) => {
      const values = { ...current.toObject(), ...payload } as Record<string, unknown>;
      const validationError = validateOpportunity(values);
      if (validationError) throw new ScholarshipAwardError(400, validationError);
      if (!canOfferType(provider, values.type as OpportunityType)) {
        throw new ScholarshipAwardError(403, 'This opportunity type is not enabled in your provider services.');
      }
      if (payload.status === 'expired') throw new ScholarshipAwardError(400, 'Expired status is assigned automatically when a deadline passes.');
      current.set(payload);
      if (current.type !== 'scholarship') scholarshipFields.forEach((field) => current.set(field, undefined));
    }, req.body.revision);
    await updated.populate('providerId', providerSelect);
    res.status(200).json({ success: true, message: 'Opportunity updated', data: { opportunity: updated } });
  } catch (error) {
    if (error instanceof ScholarshipAwardError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    res.status(503).json({ success: false, message: 'Unable to update this opportunity. Please try again later.' });
  }
};

/** DELETE /api/opportunities/:id */
export const deleteOpportunity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listing: opportunity, retained } = await removeScholarshipAwareListing(req.params.id, req.user!._id, 'provider');
    if (!opportunity) {
      res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
      return;
    }
    res.status(200).json({ success: true, message: retained ? 'Opportunity closed; application history retained.' : 'Opportunity deleted', data: { retained } });
  } catch (error) {
    if (error instanceof ScholarshipAwardError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    res.status(503).json({ success: false, message: 'Unable to remove this opportunity.' });
  }
};
