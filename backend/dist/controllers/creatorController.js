"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifiedCreatorProviderOnly = exports.updatePromotionRequestStatus = exports.listProviderPromotionRequests = exports.listMyPromotionRequests = exports.createPromotionRequest = exports.getCreator = exports.listCreators = exports.updateCreatorProfile = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const PromotionRequest_1 = __importDefault(require("../models/PromotionRequest"));
const User_1 = __importDefault(require("../models/User"));
const platforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'other'];
const compensationTypes = ['paid', 'product_exchange', 'experience', 'affiliate'];
const providerFields = 'fullName providerProfile.organizationName providerProfile.organizationType providerProfile.verified';
const creatorFields = 'fullName studentProfile.creatorProfile';
const requestStudentFields = 'fullName';
const textList = (value, maxItems, maxLength) => {
    if (!Array.isArray(value) || value.length > maxItems)
        return null;
    const cleaned = value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean);
    return cleaned.every((item) => item.length <= maxLength) ? [...new Set(cleaned)] : null;
};
const validUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
        return false;
    }
};
const verifyProvider = (req, res, next) => {
    if (!req.user?.providerProfile?.verified) {
        res.status(403).json({ success: false, message: 'Only verified providers can access the creator marketplace.' });
        return;
    }
    next();
};
/** PUT /api/creators/profile */
const updateCreatorProfile = async (req, res) => {
    try {
        const student = await User_1.default.findById(req.user._id);
        if (!student?.studentProfile) {
            res.status(404).json({ success: false, message: 'Student profile not found.' });
            return;
        }
        const body = req.body;
        if (typeof body.isDiscoverable !== 'boolean') {
            res.status(400).json({ success: false, message: 'Choose whether your creator profile is discoverable.' });
            return;
        }
        const niches = textList(body.niches, 12, 80);
        const contentTypes = textList(body.contentTypes, 12, 80);
        const sampleWorkLinks = textList(body.sampleWorkLinks ?? [], 8, 500);
        if (!niches || !contentTypes || !sampleWorkLinks || !sampleWorkLinks.every(validUrl)) {
            res.status(400).json({ success: false, message: 'Provide valid creator profile lists and sample-work links.' });
            return;
        }
        if (!Array.isArray(body.compensationPreference) || body.compensationPreference.length > compensationTypes.length || body.compensationPreference.some((item) => !compensationTypes.includes(item))) {
            res.status(400).json({ success: false, message: 'Select valid compensation preferences.' });
            return;
        }
        if (!Array.isArray(body.platforms) || body.platforms.length > 6) {
            res.status(400).json({ success: false, message: 'Add up to six valid creator platforms.' });
            return;
        }
        const creatorPlatforms = [];
        for (const item of body.platforms) {
            const platform = item && typeof item === 'object' ? item : {};
            const name = platform.platform;
            const handle = typeof platform.handle === 'string' ? platform.handle.trim() : '';
            const profileUrl = typeof platform.profileUrl === 'string' ? platform.profileUrl.trim() : '';
            const followerCount = platform.followerCount;
            if (!platforms.includes(name) || !handle || handle.length > 100 || !validUrl(profileUrl) || (followerCount !== undefined && (!Number.isInteger(followerCount) || followerCount < 0 || followerCount > 1000000000))) {
                res.status(400).json({ success: false, message: 'Each platform needs a valid type, handle, profile link, and optional follower count.' });
                return;
            }
            creatorPlatforms.push({ platform: name, handle, profileUrl, ...(typeof followerCount === 'number' ? { followerCount } : {}) });
        }
        if (body.isDiscoverable && (!creatorPlatforms.length || !niches.length || !contentTypes.length || !body.compensationPreference.length)) {
            res.status(400).json({ success: false, message: 'Add a platform, niche, content type, and compensation preference before becoming discoverable.' });
            return;
        }
        student.studentProfile.creatorProfile = {
            isDiscoverable: body.isDiscoverable,
            platforms: creatorPlatforms,
            niches,
            contentTypes,
            compensationPreference: body.compensationPreference,
            ...(sampleWorkLinks.length ? { sampleWorkLinks } : {}),
        };
        student.markModified('studentProfile.creatorProfile');
        await student.save();
        res.json({ success: true, message: body.isDiscoverable ? 'Your creator profile is visible to verified providers.' : 'Your creator profile is hidden from providers.', data: { user: student } });
    }
    catch (error) {
        console.error('Update creator profile error:', error);
        res.status(500).json({ success: false, message: 'Unable to save your creator profile.' });
    }
};
exports.updateCreatorProfile = updateCreatorProfile;
/** GET /api/creators */
const listCreators = async (req, res) => {
    try {
        const filter = { role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true };
        const queryText = (value) => typeof value === 'string' ? value.trim().slice(0, 80) : '';
        const regexFor = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const niche = queryText(req.query.niche);
        const contentType = queryText(req.query.contentType);
        const platform = queryText(req.query.platform);
        const compensationPreference = queryText(req.query.compensationPreference);
        if (niche)
            filter['studentProfile.creatorProfile.niches'] = regexFor(niche);
        if (contentType)
            filter['studentProfile.creatorProfile.contentTypes'] = regexFor(contentType);
        if (platform && platforms.includes(platform))
            filter['studentProfile.creatorProfile.platforms.platform'] = platform;
        if (compensationPreference && compensationTypes.includes(compensationPreference))
            filter['studentProfile.creatorProfile.compensationPreference'] = compensationPreference;
        const creators = await User_1.default.find(filter).select(creatorFields).sort({ fullName: 1 }).limit(100);
        res.json({ success: true, data: { creators } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load the creator directory.' });
    }
};
exports.listCreators = listCreators;
/** GET /api/creators/:studentId */
const getCreator = async (req, res) => {
    try {
        if (!mongoose_1.default.isValidObjectId(req.params.studentId)) {
            res.status(400).json({ success: false, message: 'Invalid student ID.' });
            return;
        }
        const creator = await User_1.default.findOne({ _id: req.params.studentId, role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true }).select(creatorFields);
        if (!creator) {
            res.status(404).json({ success: false, message: 'Creator profile not found.' });
            return;
        }
        res.json({ success: true, data: { creator } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load this creator profile.' });
    }
};
exports.getCreator = getCreator;
/** POST /api/promotion-requests */
const createPromotionRequest = async (req, res) => {
    try {
        const body = req.body;
        const studentId = body.studentId;
        const campaignBrief = typeof body.campaignBrief === 'string' ? body.campaignBrief.trim() : '';
        const deliverables = typeof body.deliverables === 'string' ? body.deliverables.trim() : '';
        const compensationType = body.compensationType;
        const compensationDetails = typeof body.compensationDetails === 'string' ? body.compensationDetails.trim() : '';
        const deadline = body.deadline ? new Date(String(body.deadline)) : undefined;
        if (!mongoose_1.default.isValidObjectId(studentId) || !campaignBrief || campaignBrief.length > 1000 || !deliverables || deliverables.length > 2000 || !compensationTypes.includes(compensationType) || compensationDetails.length > 1000 || (deadline && Number.isNaN(deadline.getTime()))) {
            res.status(400).json({ success: false, message: 'Provide a discoverable creator, campaign brief, deliverables, and compensation type.' });
            return;
        }
        if (deadline && deadline.getTime() <= Date.now()) {
            res.status(400).json({ success: false, message: 'Campaign deadline must be in the future.' });
            return;
        }
        const creator = await User_1.default.exists({ _id: studentId, role: 'student', accountStatus: 'active', 'studentProfile.creatorProfile.isDiscoverable': true });
        if (!creator) {
            res.status(404).json({ success: false, message: 'This creator profile is not available.' });
            return;
        }
        const request = await PromotionRequest_1.default.create({ studentId, providerId: req.user._id, campaignBrief, deliverables, compensationType, ...(compensationDetails ? { compensationDetails } : {}), ...(deadline ? { deadline } : {}) });
        const populatedRequest = await PromotionRequest_1.default.findById(request._id)
            .populate('studentId', requestStudentFields)
            .populate('providerId', providerFields);
        res.status(201).json({ success: true, message: 'Promotion request sent.', data: { request: populatedRequest || request } });
    }
    catch (error) {
        console.error('Create promotion request error:', error);
        res.status(500).json({ success: false, message: 'Unable to send this promotion request.' });
    }
};
exports.createPromotionRequest = createPromotionRequest;
/** GET /api/promotion-requests/mine */
const listMyPromotionRequests = async (req, res) => {
    try {
        const requests = await PromotionRequest_1.default.find({ studentId: req.user._id }).sort({ createdAt: -1 })
            .populate('studentId', requestStudentFields)
            .populate('providerId', providerFields);
        res.json({ success: true, data: { requests } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load promotion requests.' });
    }
};
exports.listMyPromotionRequests = listMyPromotionRequests;
/** GET /api/promotion-requests/provider */
const listProviderPromotionRequests = async (req, res) => {
    try {
        const requests = await PromotionRequest_1.default.find({ providerId: req.user._id }).sort({ createdAt: -1 })
            .populate('studentId', requestStudentFields)
            .populate('providerId', providerFields);
        res.json({ success: true, data: { requests } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load promotion requests.' });
    }
};
exports.listProviderPromotionRequests = listProviderPromotionRequests;
/** PATCH /api/promotion-requests/:id/status */
const updatePromotionRequestStatus = async (req, res) => {
    try {
        if (!mongoose_1.default.isValidObjectId(req.params.id)) {
            res.status(400).json({ success: false, message: 'Invalid promotion request ID.' });
            return;
        }
        const status = req.body.status;
        const request = await PromotionRequest_1.default.findById(req.params.id);
        if (!request) {
            res.status(404).json({ success: false, message: 'Promotion request not found.' });
            return;
        }
        const isStudent = req.user.role === 'student' && request.studentId.equals(req.user._id);
        const isProvider = req.user.role === 'provider' && request.providerId.equals(req.user._id) && req.user.providerProfile?.verified;
        if (!isStudent && !isProvider) {
            res.status(403).json({ success: false, message: 'You cannot update this promotion request.' });
            return;
        }
        if (isStudent && request.status === 'pending' && ['accepted', 'declined'].includes(status))
            request.status = status;
        else if (isProvider && request.status === 'accepted' && status === 'completed')
            request.status = 'completed';
        else {
            res.status(400).json({ success: false, message: 'This status change is not allowed.' });
            return;
        }
        await request.save();
        const populatedRequest = await PromotionRequest_1.default.findById(request._id)
            .populate('studentId', requestStudentFields)
            .populate('providerId', providerFields);
        res.json({ success: true, message: 'Promotion request updated.', data: { request: populatedRequest || request } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to update this promotion request.' });
    }
};
exports.updatePromotionRequestStatus = updatePromotionRequestStatus;
exports.verifiedCreatorProviderOnly = verifyProvider;
//# sourceMappingURL=creatorController.js.map