import { Request, Response } from 'express';
import Resource, {
  IResourceAccessDetails,
  ResourceAccessType,
  ResourceCategory,
  ResourceCondition,
  ResourceStatus,
} from '../models/Resource';
import { isProviderOfferingAllowed } from '../utils/providerCapabilities';

const categories: ResourceCategory[] = ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'];
const accessTypes: ResourceAccessType[] = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const statuses: ResourceStatus[] = ['available', 'claimed'];
const studentAccessTypes: ResourceAccessType[] = ['borrow', 'share', 'donation'];
const peerToPeerAccessTypes: ResourceAccessType[] = ['borrow', 'share'];
const providerManagedAccessTypes: ResourceAccessType[] = ['rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const listedBySelect = 'fullName email role providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.verificationStatus providerProfile.contactEmail providerProfile.phone';

type Payload = Record<string, unknown>;

const isRecord = (value: unknown): value is Payload => typeof value === 'object' && value !== null && !Array.isArray(value);
const validNumber = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const validInteger = (value: unknown, minimum = 0): value is number => Number.isInteger(value) && (value as number) >= minimum;
const requiredText = (value: unknown, label: string, maxLength = 1000): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
};
const requiredAmount = (value: unknown, label: string): number => {
  if (!validNumber(value)) throw new Error(`${label} must be a valid amount.`);
  return value;
};
const requiredPositiveInteger = (value: unknown, label: string): number => {
  if (!validInteger(value, 1)) throw new Error(`${label} must be a whole number of at least 1.`);
  return value;
};
const requiredDate = (value: unknown, label: string): Date => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
};
const requiredCriteria = (value: unknown): string[] => {
  if (!Array.isArray(value)) throw new Error('Eligibility criteria is required.');
  const criteria = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
  if (!criteria.length) throw new Error('Add at least one eligibility criterion.');
  if (criteria.some((item) => item.length > 300)) throw new Error('Each eligibility criterion must be 300 characters or fewer.');
  return criteria;
};

const detailPayload = (body: Payload, accessType: ResourceAccessType): IResourceAccessDetails => {
  if (!isRecord(body.accessDetails)) throw new Error('Access details are required for this listing.');

  switch (accessType) {
    case 'borrow':
    case 'share': {
      const details = body.accessDetails.borrowShare;
      if (!isRecord(details)) throw new Error('Borrow or share details are required.');
      return { borrowShare: {
        borrowDurationDays: requiredPositiveInteger(details.borrowDurationDays, 'Borrow duration'),
        pickupLocation: requiredText(details.pickupLocation, 'Pickup location', 200),
        returnCondition: requiredText(details.returnCondition, 'Return condition notes'),
      } };
    }
    case 'rent': {
      const details = body.accessDetails.rent;
      if (!isRecord(details)) throw new Error('Rental details are required.');
      const securityDeposit = details.securityDeposit;
      if (securityDeposit !== undefined && !validNumber(securityDeposit)) throw new Error('Security deposit must be a valid amount.');
      return { rent: {
        pricePerMonth: requiredAmount(details.pricePerMonth, 'Price per month'),
        currency: requiredText(details.currency, 'Currency', 6).toUpperCase(),
        minRentalMonths: requiredPositiveInteger(details.minRentalMonths, 'Minimum rental period'),
        ...(securityDeposit === undefined ? {} : { securityDeposit }),
      } };
    }
    case 'installment': {
      const details = body.accessDetails.installment;
      if (!isRecord(details)) throw new Error('Installment details are required.');
      const totalPrice = requiredAmount(details.totalPrice, 'Total price');
      const downPayment = requiredAmount(details.downPayment, 'Down payment');
      if (downPayment > totalPrice) throw new Error('Down payment cannot be greater than the total price.');
      return { installment: {
        totalPrice,
        downPayment,
        monthlyInstallmentAmount: requiredAmount(details.monthlyInstallmentAmount, 'Monthly installment amount'),
        numberOfMonths: requiredPositiveInteger(details.numberOfMonths, 'Number of months'),
        lateFeePolicy: requiredText(details.lateFeePolicy, 'Late fee policy', 500),
      } };
    }
    case 'interest_free': {
      const details = body.accessDetails.interestFree;
      if (!isRecord(details)) throw new Error('Interest-free plan details are required.');
      return { interestFree: {
        totalPrice: requiredAmount(details.totalPrice, 'Total price'),
        monthlyInstallmentAmount: requiredAmount(details.monthlyInstallmentAmount, 'Monthly installment amount'),
        numberOfMonths: requiredPositiveInteger(details.numberOfMonths, 'Number of months'),
        eligibilityCriteria: requiredCriteria(details.eligibilityCriteria),
        repaymentStartDate: requiredDate(details.repaymentStartDate, 'Repayment start date'),
        interestRate: 0,
      } };
    }
    case 'sponsorship': {
      const details = body.accessDetails.sponsorship;
      if (!isRecord(details)) throw new Error('Sponsorship details are required.');
      const applicationDeadline = requiredDate(details.applicationDeadline, 'Application deadline');
      if (applicationDeadline.getTime() <= Date.now()) throw new Error('Application deadline must be in the future.');
      return { sponsorship: {
        eligibilityCriteria: requiredCriteria(details.eligibilityCriteria),
        applicationDeadline,
        numberOfUnitsAvailable: requiredPositiveInteger(details.numberOfUnitsAvailable, 'Number of units available'),
        sponsorOrganization: requiredText(details.sponsorOrganization, 'Sponsor organization', 160),
      } };
    }
    case 'donation': {
      const details = body.accessDetails.donation;
      if (!isRecord(details)) throw new Error('Donation details are required.');
      if (!validNumber(details.itemAgeYears) || details.itemAgeYears > 100) throw new Error('Item age must be between 0 and 100 years.');
      const claimDeadline = requiredDate(details.claimDeadline, 'Claim deadline');
      if (claimDeadline.getTime() <= Date.now()) throw new Error('Claim deadline must be in the future.');
      return { donation: {
        itemAgeYears: details.itemAgeYears,
        conditionNotes: requiredText(details.conditionNotes, 'Condition notes'),
        pickupOrDeliveryMethod: requiredText(details.pickupOrDeliveryMethod, 'Pickup or delivery method', 100),
        claimDeadline,
      } };
    }
  }
};

const listingPayload = (body: Payload) => {
  const itemName = requiredText(body.itemName, 'Item name', 160);
  if (!categories.includes(body.category as ResourceCategory)) throw new Error('Select a valid resource category.');
  if (body.condition !== undefined && !['new', 'used_good', 'used_fair'].includes(body.condition as ResourceCondition)) throw new Error('Select a valid item condition.');
  if (!accessTypes.includes(body.accessType as ResourceAccessType)) throw new Error('Select a valid access type.');
  if (!validInteger(body.quantityAvailable, 1)) throw new Error('Quantity available must be a whole number of at least 1.');
  if (body.status !== undefined && !statuses.includes(body.status as ResourceStatus)) throw new Error('Select a valid listing status.');

  const accessType = body.accessType as ResourceAccessType;
  return {
    itemName,
    category: body.category as ResourceCategory,
    ...(body.condition === undefined || body.condition === '' ? {} : { condition: body.condition as ResourceCondition }),
    accessType,
    quantityAvailable: body.quantityAvailable as number,
    status: (body.status || 'available') as ResourceStatus,
    accessDetails: detailPayload(body, accessType),
  };
};

const canOfferProviderManagedAccess = (req: Request): boolean => {
  if (req.user?.role === 'admin') return true;
  if (req.user?.role !== 'provider') return false;
  const profile = req.user.providerProfile;
  return profile?.verified === true
    && profile.opportunityCategories?.includes('technical_resources') === true
    && isProviderOfferingAllowed(profile.organizationType, 'technical_resources');
};

/** POST /api/resources */
export const createResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = listingPayload(req.body as Payload);
    if (req.user?.role === 'student' && !studentAccessTypes.includes(payload.accessType)) {
      res.status(403).json({ success: false, message: 'Students can list resources only for borrow, share, or donation.' });
      return;
    }
    if (peerToPeerAccessTypes.includes(payload.accessType) && req.user?.role !== 'student') {
      res.status(403).json({ success: false, message: 'Borrow and share listings are reserved for student-to-student access.' });
      return;
    }
    if (providerManagedAccessTypes.includes(payload.accessType) && !canOfferProviderManagedAccess(req)) {
      res.status(403).json({ success: false, message: 'Provider-managed resource listings require a verified provider account with technical resources enabled.' });
      return;
    }
    if (providerManagedAccessTypes.includes(payload.accessType) && req.user?.role === 'provider' && !req.user.providerProfile?.resourceAccessMethods?.includes(payload.accessType)) {
      res.status(403).json({ success: false, message: `Your provider profile is not enabled to offer ${payload.accessType.replace('_', ' ')} arrangements.` });
      return;
    }

    const resource = await Resource.create({
      ...payload,
      listedBy: req.user!._id,
      providerOrgVerified: req.user!.role === 'provider' && req.user!.providerProfile?.verified === true,
    });
    await resource.populate('listedBy', listedBySelect);
    res.status(201).json({ success: true, message: 'Resource listing created.', data: { resource } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create resource listing.';
    res.status(400).json({ success: false, message });
  }
};

/** GET /api/resources?item=Laptop&accessType=installment */
export const listResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { status: 'available' };
    if (typeof req.query.accessType === 'string' && accessTypes.includes(req.query.accessType as ResourceAccessType)) filter.accessType = req.query.accessType;
    if (typeof req.query.category === 'string' && categories.includes(req.query.category as ResourceCategory)) filter.category = req.query.category;
    if (typeof req.query.item === 'string' && req.query.item.trim()) {
      const escaped = req.query.item.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.itemName = { $regex: escaped, $options: 'i' };
    }
    const resources = await Resource.find(filter).populate('listedBy', listedBySelect).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { resources } });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to fetch resource listings.' });
  }
};

/** GET /api/resources/mine */
export const listMyResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const resources = await Resource.find({ listedBy: req.user!._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { resources } });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to fetch your resource listings.' });
  }
};

/** GET /api/resources/:id */
export const getResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findById(req.params.id).populate('listedBy', listedBySelect);
    if (!resource) { res.status(404).json({ success: false, message: 'Resource listing not found.' }); return; }
    res.status(200).json({ success: true, data: { resource } });
  } catch {
    res.status(400).json({ success: false, message: 'Invalid resource listing ID.' });
  }
};

/** PATCH /api/resources/:id/status */
export const updateResourceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!statuses.includes(req.body.status as ResourceStatus)) {
      res.status(400).json({ success: false, message: 'Status must be available or claimed.' });
      return;
    }
    const existing = await Resource.findOne({ _id: req.params.id, listedBy: req.user!._id });
    if (!existing) { res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' }); return; }
    if (req.body.status === 'available' && existing.quantityAvailable < 1) {
      res.status(400).json({ success: false, message: 'Add at least one available unit before reopening this listing.' });
      return;
    }
    existing.status = req.body.status as ResourceStatus;
    await existing.save();
    const resource = existing;
    res.status(200).json({ success: true, message: 'Listing status updated.', data: { resource } });
  } catch {
    res.status(400).json({ success: false, message: 'Unable to update listing status.' });
  }
};

/** PATCH /api/resources/:id/inventory */
export const updateResourceInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!validInteger(req.body.quantityAvailable, 0)) {
      res.status(400).json({ success: false, message: 'Available units must be a whole number of zero or more.' });
      return;
    }
    const quantityAvailable = req.body.quantityAvailable as number;
    const resource = await Resource.findOneAndUpdate(
      { _id: req.params.id, listedBy: req.user!._id },
      { quantityAvailable, status: quantityAvailable > 0 ? 'available' : 'claimed' },
      { new: true }
    );
    if (!resource) { res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' }); return; }
    res.status(200).json({ success: true, message: 'Available units updated.', data: { resource } });
  } catch {
    res.status(400).json({ success: false, message: 'Unable to update available units.' });
  }
};

/** DELETE /api/resources/:id */
export const deleteResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findOneAndDelete({ _id: req.params.id, listedBy: req.user!._id });
    if (!resource) { res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' }); return; }
    res.status(200).json({ success: true, message: 'Resource listing deleted.' });
  } catch {
    res.status(400).json({ success: false, message: 'Unable to delete resource listing.' });
  }
};
