import { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import ResourceRequest from '../models/ResourceRequest';
import User from '../models/User';

const providerServices = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];

const expireOpportunities = async (): Promise<void> => {
  await Opportunity.updateMany(
    { status: 'open', applicationDeadline: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

/** GET /api/provider/dashboard */
export const getProviderDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    await expireOpportunities();
    const providerId = req.user!._id;
    const opportunities = await Opportunity.find({ providerId }).select('_id title type status applicationDeadline createdAt views');
    const ids = opportunities.map((opportunity) => opportunity._id);
    const [applicationsReceived, resourceCount, resourceRequestsReceived, pendingResourceRequests, acceptedResourceRequests, recentApplications, recentResourceRequests] = await Promise.all([
      Application.countDocuments({ opportunityId: { $in: ids } }),
      Resource.countDocuments({ listedBy: providerId }),
      ResourceRequest.countDocuments({ providerId }),
      ResourceRequest.countDocuments({ providerId, status: 'pending' }),
      ResourceRequest.countDocuments({ providerId, status: 'accepted' }),
      Application.find({ providerId }).populate('opportunityId', 'title').sort({ appliedAt: -1 }).limit(3),
      ResourceRequest.find({ providerId }).populate('resourceId', 'itemName').sort({ createdAt: -1 }).limit(3),
    ]);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const availableResources = await Resource.countDocuments({ listedBy: providerId, status: 'available' });
    const activeListings = opportunities.filter((opportunity) => opportunity.status === 'open').length + availableResources;
    const scholarships = opportunities.filter((opportunity) => opportunity.type === 'scholarship').length;
    const expiringSoon = opportunities.filter((opportunity) => opportunity.status === 'open' && opportunity.applicationDeadline <= nextWeek).length;
    const views = opportunities.reduce((total, opportunity) => total + opportunity.views, 0);
    const recentOpportunities = [...opportunities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4);
    const recentActivity = [
      ...recentApplications.map((application) => ({
        id: application._id.toString(),
        kind: 'application' as const,
        title: 'New opportunity application',
        detail: (application.opportunityId as unknown as { title?: string })?.title || 'Opportunity',
        status: application.status,
        occurredAt: application.appliedAt,
      })),
      ...recentResourceRequests.map((request) => ({
        id: request._id.toString(),
        kind: 'resource_request' as const,
        title: 'New resource request',
        detail: (request.resourceId as unknown as { itemName?: string })?.itemName || 'Resource',
        status: request.status,
        occurredAt: request.createdAt,
      })),
      ...recentOpportunities.map((opportunity) => ({
        id: opportunity._id.toString(),
        kind: 'opportunity' as const,
        title: 'Opportunity published or updated',
        detail: opportunity.title,
        status: opportunity.status,
        occurredAt: opportunity.createdAt,
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 6);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalOpportunities: opportunities.length,
          scholarships,
          applicationsReceived,
          resourceRequestsReceived,
          pendingRequests: pendingResourceRequests,
          acceptedRequests: acceptedResourceRequests,
          activeListings,
          resourceCount,
          expiringSoon,
          views,
        },
        recentOpportunities,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Provider dashboard error:', error);
    res.status(500).json({ success: false, message: 'Unable to load provider dashboard.' });
  }
};

/** PUT /api/provider/profile */
export const updateProviderProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await User.findById(req.user!._id);
    if (!provider?.providerProfile) { res.status(404).json({ success: false, message: 'Provider profile not found.' }); return; }
    const fields = ['organizationName', 'contactPerson', 'contactEmail', 'phone', 'location', 'website', 'logoUrl', 'description'] as const;
    for (const field of fields) {
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
    const offerings = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];
    const resourceMethods = ['rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
    if (req.body.opportunityCategories !== undefined) {
      if (!Array.isArray(req.body.opportunityCategories) || req.body.opportunityCategories.length === 0 || req.body.opportunityCategories.some((item: unknown) => typeof item !== 'string' || !offerings.includes(item))) {
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
    await provider.save();
    res.status(200).json({ success: true, message: 'Provider profile updated', data: { user: provider } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to update provider profile.' });
  }
};

/** GET /api/providers/:id */
export const getPublicProviderProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await User.findOne({ _id: req.params.id, role: 'provider' })
      .select('fullName providerProfile createdAt');
    if (!provider?.providerProfile) {
      res.status(404).json({ success: false, message: 'Provider profile not found.' });
      return;
    }

    const [opportunities, resources] = await Promise.all([
      Opportunity.find({ providerId: provider._id, status: 'open' })
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
          providerProfile: provider.providerProfile,
          createdAt: provider.createdAt,
        },
        opportunities,
        resources,
      },
    });
  } catch {
    res.status(400).json({ success: false, message: 'Invalid provider ID.' });
  }
};
