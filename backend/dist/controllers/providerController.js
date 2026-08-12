"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProviderProfile = exports.updateProviderProfile = exports.getProviderDashboard = void 0;
const Application_1 = __importDefault(require("../models/Application"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const Resource_1 = __importDefault(require("../models/Resource"));
const ResourceRequest_1 = __importDefault(require("../models/ResourceRequest"));
const User_1 = __importDefault(require("../models/User"));
const providerServices = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];
const expireOpportunities = async () => {
    await Opportunity_1.default.updateMany({ status: 'open', applicationDeadline: { $lt: new Date() } }, { $set: { status: 'expired' } });
};
/** GET /api/provider/dashboard */
const getProviderDashboard = async (req, res) => {
    try {
        await expireOpportunities();
        const providerId = req.user._id;
        const opportunities = await Opportunity_1.default.find({ providerId }).select('_id title type status applicationDeadline createdAt views');
        const ids = opportunities.map((opportunity) => opportunity._id);
        const [applicationsReceived, resourceCount, resourceRequestsReceived, pendingResourceRequests, acceptedResourceRequests, recentApplications, recentResourceRequests] = await Promise.all([
            Application_1.default.countDocuments({ opportunityId: { $in: ids } }),
            Resource_1.default.countDocuments({ listedBy: providerId }),
            ResourceRequest_1.default.countDocuments({ providerId }),
            ResourceRequest_1.default.countDocuments({ providerId, status: 'pending' }),
            ResourceRequest_1.default.countDocuments({ providerId, status: 'accepted' }),
            Application_1.default.find({ providerId }).populate('opportunityId', 'title').sort({ appliedAt: -1 }).limit(3),
            ResourceRequest_1.default.find({ providerId }).populate('resourceId', 'itemName').sort({ createdAt: -1 }).limit(3),
        ]);
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const availableResources = await Resource_1.default.countDocuments({ listedBy: providerId, status: 'available' });
        const activeListings = opportunities.filter((opportunity) => opportunity.status === 'open').length + availableResources;
        const scholarships = opportunities.filter((opportunity) => opportunity.type === 'scholarship').length;
        const expiringSoon = opportunities.filter((opportunity) => opportunity.status === 'open' && opportunity.applicationDeadline <= nextWeek).length;
        const views = opportunities.reduce((total, opportunity) => total + opportunity.views, 0);
        const recentOpportunities = [...opportunities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4);
        const recentActivity = [
            ...recentApplications.map((application) => ({
                id: application._id.toString(),
                kind: 'application',
                title: 'New opportunity application',
                detail: application.opportunityId?.title || 'Opportunity',
                status: application.status,
                occurredAt: application.appliedAt,
            })),
            ...recentResourceRequests.map((request) => ({
                id: request._id.toString(),
                kind: 'resource_request',
                title: 'New resource request',
                detail: request.resourceId?.itemName || 'Resource',
                status: request.status,
                occurredAt: request.createdAt,
            })),
            ...recentOpportunities.map((opportunity) => ({
                id: opportunity._id.toString(),
                kind: 'opportunity',
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
    }
    catch (error) {
        console.error('Provider dashboard error:', error);
        res.status(500).json({ success: false, message: 'Unable to load provider dashboard.' });
    }
};
exports.getProviderDashboard = getProviderDashboard;
/** PUT /api/provider/profile */
const updateProviderProfile = async (req, res) => {
    try {
        const provider = await User_1.default.findById(req.user._id);
        if (!provider?.providerProfile) {
            res.status(404).json({ success: false, message: 'Provider profile not found.' });
            return;
        }
        const fields = ['organizationName', 'contactPerson', 'contactEmail', 'phone', 'location', 'website', 'logoUrl', 'description'];
        for (const field of fields) {
            if (req.body[field] !== undefined)
                provider.providerProfile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
        if (!provider.providerProfile.organizationName || !provider.providerProfile.contactPerson || !provider.providerProfile.contactEmail || !provider.providerProfile.phone || !provider.providerProfile.location) {
            res.status(400).json({ success: false, message: 'Organization name, contact person, email, phone and location are required.' });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.providerProfile.contactEmail)) {
            res.status(400).json({ success: false, message: 'Enter a valid contact email.' });
            return;
        }
        if (req.body.opportunityCategories !== undefined) {
            if (!Array.isArray(req.body.opportunityCategories) || !req.body.opportunityCategories.length || req.body.opportunityCategories.some((service) => typeof service !== 'string' || !providerServices.includes(service))) {
                res.status(400).json({ success: false, message: 'Select at least one valid service offering.' });
                return;
            }
            provider.providerProfile.opportunityCategories = [...new Set(req.body.opportunityCategories)];
        }
        await provider.save();
        res.status(200).json({ success: true, message: 'Provider profile updated', data: { user: provider } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Unable to update provider profile.' });
    }
};
exports.updateProviderProfile = updateProviderProfile;
/** GET /api/providers/:id */
const getPublicProviderProfile = async (req, res) => {
    try {
        const provider = await User_1.default.findOne({ _id: req.params.id, role: 'provider' })
            .select('fullName providerProfile createdAt');
        if (!provider?.providerProfile) {
            res.status(404).json({ success: false, message: 'Provider profile not found.' });
            return;
        }
        const [opportunities, resources] = await Promise.all([
            Opportunity_1.default.find({ providerId: provider._id, status: 'open' })
                .select('title type description location workMode applicationDeadline status requiredSkills createdAt')
                .sort({ createdAt: -1 }),
            Resource_1.default.find({ listedBy: provider._id, status: 'available' })
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
    }
    catch {
        res.status(400).json({ success: false, message: 'Invalid provider ID.' });
    }
};
exports.getPublicProviderProfile = getPublicProviderProfile;
//# sourceMappingURL=providerController.js.map