import { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import ResourceRequest from '../models/ResourceRequest';
import User from '../models/User';
import { isProviderOfferingAllowed, providerOfferings } from '../utils/providerCapabilities';
import { publicProviderProfileSelect, toPublicProviderDetails } from '../utils/publicProvider';
import { saveVerifiedProviderProfile } from '../services/providerVerification';
import { AdminActionError } from '../services/adminUsers';
import mongoose from 'mongoose';
import { effectiveOpportunityStatus } from '../services/opportunityPolicy';

const providerServices = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];


/** GET /api/provider/dashboard */
export const getProviderDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const providerId = req.user!._id;
    const opportunities = await Opportunity.find({ providerId }).select('_id title type status applicationDeadline createdAt views');
    opportunities.forEach(row => { row.status = effectiveOpportunityStatus(row); });
    const ids = opportunities.map((opportunity) => opportunity._id);
    const [applicationsReceived, acceptedApplications, connectedStudentIds, resourceCount, resourceRequestsReceived, pendingResourceRequests, acceptedResourceRequests, resourceRequestsAccepted, resourceStudentIds, recentApplications, recentResourceRequests] = await Promise.all([
      Application.countDocuments({ providerId }),
      Application.countDocuments({ providerId, status: 'accepted' }),
      Application.distinct('studentId', { providerId, status: 'accepted' }),
      Resource.countDocuments({ listedBy: providerId }),
      ResourceRequest.countDocuments({ providerId }),
      ResourceRequest.countDocuments({ providerId, status: 'pending' }),
      ResourceRequest.countDocuments({ providerId, status: 'accepted' }),
      ResourceRequest.countDocuments({ providerId, status: { $in: ['accepted', 'completed'] } }),
      ResourceRequest.distinct('studentId', { providerId, status: { $in: ['accepted', 'completed'] } }),
      Application.find({ providerId }).populate('opportunityId', 'title').sort({ appliedAt: -1 }).limit(3),
      ResourceRequest.find({ providerId }).populate('resourceId', 'itemName').sort({ createdAt: -1 }).limit(3),
    ]);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const availableResources = await Resource.countDocuments({ listedBy: providerId, status: 'available' });
    const activeListings = opportunities.filter((opportunity) => opportunity.status === 'open').length + availableResources;
    const scholarships = opportunities.filter((opportunity) => opportunity.type === 'scholarship').length;
    const paidProjects = opportunities.filter((opportunity) => opportunity.type === 'job' || opportunity.type === 'freelance' || opportunity.type === 'promotion').length;
    const internships = opportunities.filter((opportunity) => opportunity.type === 'internship').length;
    const trainingPrograms = opportunities.filter((opportunity) => opportunity.type === 'course' || opportunity.type === 'workshop').length;
    const mentorshipListings = opportunities.filter((opportunity) => opportunity.type === 'mentorship').length;
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
          paidProjects,
          internships,
          trainingPrograms,
          mentorshipListings,
          applicationsReceived,
          acceptedApplications,
          studentsConnected: connectedStudentIds.length,
          resourceRequestsReceived,
          pendingRequests: pendingResourceRequests,
          acceptedRequests: acceptedResourceRequests,
          activeListings,
          resourceCount,
          resourceRequestsAccepted,
          resourceStudentsConnected: resourceStudentIds.length,
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
