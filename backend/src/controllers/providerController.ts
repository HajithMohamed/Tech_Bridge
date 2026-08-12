import { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import User from '../models/User';

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
    const [applicationsReceived, resourceCount] = await Promise.all([
      Application.countDocuments({ opportunityId: { $in: ids } }),
      Resource.countDocuments({ listedBy: providerId }),
    ]);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const activeListings = opportunities.filter((opportunity) => opportunity.status === 'open').length;
    const scholarships = opportunities.filter((opportunity) => opportunity.type === 'scholarship').length;
    const expiringSoon = opportunities.filter((opportunity) => opportunity.status === 'open' && opportunity.applicationDeadline <= nextWeek).length;
    const views = opportunities.reduce((total, opportunity) => total + opportunity.views, 0);
    const recentOpportunities = [...opportunities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4);

    res.status(200).json({
      success: true,
      data: {
        stats: { totalOpportunities: opportunities.length, scholarships, applicationsReceived, activeListings, resourceCount, expiringSoon, views },
        recentOpportunities,
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
      provider.providerProfile.opportunityCategories = req.body.opportunityCategories;
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
