import { Request, Response } from 'express';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import User from '../models/User';
import { isProviderOfferingAllowed, providerOfferings } from '../utils/providerCapabilities';
import { publicProviderProfileSelect, toPublicProviderDetails } from '../utils/publicProvider';
import { saveVerifiedProviderProfile } from '../services/providerVerification';
import { AdminActionError } from '../services/adminUsers';
import mongoose from 'mongoose';

const providerServices = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];


export { getProviderAnalyticsDashboard as getProviderDashboard } from './analyticsController';

/** PUT /api/provider/profile */
export const updateProviderProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await User.findById(req.user!._id);
    if (!provider?.providerProfile) { res.status(404).json({ success: false, message: 'Provider profile not found.' }); return; }
    const fields = ['organizationName', 'contactPerson', 'contactEmail', 'phone', 'location', 'website', 'logoUrl', 'description'] as const;
    for (const field of fields) {
      if (req.body[field] !== undefined && typeof req.body[field] !== 'string') { res.status(400).json({ success: false, message: 'Provider text fields must be strings.' }); return; }
      if (req.body[field] !== undefined) provider.providerProfile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    }
    if (!provider.providerProfile.organizationName || !provider.providerProfile.contactPerson || !provider.providerProfile.contactEmail || !provider.providerProfile.phone || !provider.providerProfile.location) {
      res.status(400).json({ success: false, message: 'Organization name, contact person, email, phone and location are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.providerProfile.contactEmail)) {
      res.status(400).json({ success: false, message: 'Enter a valid contact email.' });
      return;
    }
    const resourceMethods = ['rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
    if (req.body.opportunityCategories !== undefined) {
      if (!Array.isArray(req.body.opportunityCategories) || req.body.opportunityCategories.length === 0 || req.body.opportunityCategories.some((item: unknown) => typeof item !== 'string' || !providerOfferings.includes(item as typeof providerOfferings[number]) || !isProviderOfferingAllowed(provider.providerProfile!.organizationType, item))) {
        res.status(400).json({ success: false, message: 'Select at least one valid provider offering.' });
        return;
      }
      provider.providerProfile.opportunityCategories = [...new Set(req.body.opportunityCategories as string[])];
    }
    if (req.body.resourceAccessMethods !== undefined) {
      if (!Array.isArray(req.body.resourceAccessMethods) || req.body.resourceAccessMethods.some((item: unknown) => typeof item !== 'string' || !resourceMethods.includes(item))) {
        res.status(400).json({ success: false, message: 'Select valid resource access methods.' });
        return;
      }
      if (!provider.providerProfile.opportunityCategories.includes('technical_resources') && req.body.resourceAccessMethods.length) {
        res.status(400).json({ success: false, message: 'Enable technical resources before selecting resource access methods.' });
        return;
      }
      provider.providerProfile.resourceAccessMethods = req.body.resourceAccessMethods;
    }
    const changes: Record<string, unknown> = {};
    for (const field of [...fields, 'opportunityCategories', 'resourceAccessMethods'] as const) if (req.body[field] !== undefined) changes[field] = provider.providerProfile[field];
    const updated = await saveVerifiedProviderProfile(provider._id, Number(provider.get('__v') || 0), changes);
    res.status(200).json({ success: true, message: updated?.providerProfile?.verified ? 'Provider profile updated' : 'Profile updated. Submit updated evidence for verification.', data: { user: updated } });
  } catch (error) {
    if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    if (error instanceof mongoose.Error.ValidationError) { res.status(400).json({ success: false, message: 'Check your provider profile fields.' }); return; }
    res.status(503).json({ success: false, message: 'Unable to update provider profile.' });
  }
};

/** GET /api/providers/:id */
export const getPublicProviderProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await User.findOne({ _id: req.params.id, role: 'provider' })
      .select(publicProviderProfileSelect);
    if (!provider?.providerProfile) {
      res.status(404).json({ success: false, message: 'Provider profile not found.' });
      return;
    }
    const publishedOwner = await User.exists({ _id: provider._id, role: 'provider', accountStatus: { $ne: 'suspended' }, 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED', $or: [{ requiresEmailVerification: { $ne: true } }, { emailVerifiedAt: { $type: 'date' } }] });
    const [opportunities, resources] = await Promise.all([
      Opportunity.find({ providerId: provider._id, ...(!publishedOwner ? { _id: { $exists: false } } : {}), status: 'open', applicationDeadline: { $gt: new Date() }, scholarshipWithdrawnByAdmin: { $ne: true }, opportunityWithdrawnByAdmin: { $ne: true } })
        .select('title type description location workMode applicationDeadline status requiredSkills createdAt')
        .sort({ createdAt: -1 }),
      Resource.find({ listedBy: provider._id, status: 'available' })
        .select('itemName category condition accessType listedBy providerOrgVerified quantityAvailable status accessDetails createdAt')
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        provider: {
          _id: provider._id,
          fullName: provider.fullName,
          providerProfile: toPublicProviderDetails(provider.providerProfile),
          createdAt: provider.createdAt,
        },
        opportunities,
        resources: resources.map((resource) => ({ ...resource.toObject(), providerOrgVerified: provider.providerProfile?.verified === true })),
      },
    });
  } catch {
    res.status(400).json({ success: false, message: 'Invalid provider ID.' });
  }
};
