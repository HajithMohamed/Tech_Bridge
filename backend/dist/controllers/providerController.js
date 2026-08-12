"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProviderProfile = exports.getProviderDashboard = void 0;
const Application_1 = __importDefault(require("../models/Application"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const Resource_1 = __importDefault(require("../models/Resource"));
const User_1 = __importDefault(require("../models/User"));
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
        const [applicationsReceived, resourceCount] = await Promise.all([
            Application_1.default.countDocuments({ opportunityId: { $in: ids } }),
            Resource_1.default.countDocuments({ providerId }),
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
        await provider.save();
        res.status(200).json({ success: true, message: 'Provider profile updated', data: { user: provider } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Unable to update provider profile.' });
    }
};
exports.updateProviderProfile = updateProviderProfile;
//# sourceMappingURL=providerController.js.map