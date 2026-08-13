"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateResourceRequestStatus = exports.listReceivedResourceRequests = exports.listProviderResourceRequests = exports.listMyResourceRequests = exports.createResourceRequest = void 0;
const ResourceRequest_1 = __importDefault(require("../models/ResourceRequest"));
const Resource_1 = __importDefault(require("../models/Resource"));
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const resourceSelect = 'itemName category condition accessType quantityAvailable status';
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.contactEmail providerProfile.phone';
/** POST /api/resource-requests */
const createResourceRequest = async (req, res) => {
    try {
        const { resourceId, requestedAccessType, durationOrTerms, message } = req.body;
        const resource = await Resource_1.default.findOne({ _id: resourceId, status: 'available' });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource not found or no longer available.' });
            return;
        }
        if (resource.listedBy.equals(req.user._id)) {
            res.status(400).json({ success: false, message: 'You cannot request your own resource listing.' });
            return;
        }
        if (resource.accessType !== requestedAccessType) {
            res.status(400).json({ success: false, message: 'Invalid access type requested for this resource.' });
            return;
        }
        const existing = await ResourceRequest_1.default.findOne({
            studentId: req.user._id,
            resourceId: resource._id,
            status: { $in: ['pending', 'accepted', 'completed'] },
        });
        if (existing) {
            res.status(409).json({ success: false, message: 'You already have an active or completed request for this resource.' });
            return;
        }
        if (typeof message === 'string' && message.trim().length > 1000) {
            res.status(400).json({ success: false, message: 'Your message must be 1000 characters or fewer.' });
            return;
        }
        if (typeof durationOrTerms === 'string' && durationOrTerms.trim().length > 200) {
            res.status(400).json({ success: false, message: 'Requested terms must be 200 characters or fewer.' });
            return;
        }
        const request = await ResourceRequest_1.default.create({
            studentId: req.user._id,
            providerId: resource.listedBy,
            resourceId: resource._id,
            requestedAccessType,
            durationOrTerms: typeof durationOrTerms === 'string' ? durationOrTerms.trim() : undefined,
            message: typeof message === 'string' ? message.trim() : undefined,
        });
        await request.populate('resourceId', resourceSelect);
        res.status(201).json({
            success: true,
            message: 'Resource request submitted',
            data: { request },
        });
    }
    catch (error) {
        console.error('Create resource request error:', error);
        res.status(400).json({ success: false, message: 'Unable to submit your request.' });
    }
};
exports.createResourceRequest = createResourceRequest;
/** GET /api/resource-requests/mine */
const listMyResourceRequests = async (req, res) => {
    try {
        const requests = await ResourceRequest_1.default.find({ studentId: req.user._id })
            .populate('resourceId', resourceSelect)
            .populate('providerId', providerSelect)
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { requests } });
    }
    catch (error) {
        console.error('List student resource requests error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch your requests.' });
    }
};
exports.listMyResourceRequests = listMyResourceRequests;
/** GET /api/resource-requests/provider */
const listProviderResourceRequests = async (req, res) => {
    try {
        const requests = await ResourceRequest_1.default.find({ providerId: req.user._id })
            .populate('studentId', studentSelect)
            .populate('resourceId', resourceSelect)
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { requests } });
    }
    catch (error) {
        console.error('List provider resource requests error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch requests.' });
    }
};
exports.listProviderResourceRequests = listProviderResourceRequests;
/** GET /api/resource-requests/received — requests for a student's own shared listings */
const listReceivedResourceRequests = async (req, res) => {
    try {
        const requests = await ResourceRequest_1.default.find({ providerId: req.user._id })
            .populate('studentId', studentSelect)
            .populate('resourceId', resourceSelect)
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { requests } });
    }
    catch (error) {
        console.error('List received resource requests error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch received requests.' });
    }
};
exports.listReceivedResourceRequests = listReceivedResourceRequests;
/** PATCH /api/resource-requests/:id/status */
const updateResourceRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'rejected', 'completed'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status update.' });
            return;
        }
        const request = await ResourceRequest_1.default.findOne({ _id: req.params.id, providerId: req.user._id });
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found.' });
            return;
        }
        if (request.status === 'pending') {
            if (status === 'completed') {
                res.status(400).json({ success: false, message: 'Accept a request before marking it completed.' });
                return;
            }
            if (status === 'accepted') {
                const resource = await Resource_1.default.findOneAndUpdate({ _id: request.resourceId, status: 'available', quantityAvailable: { $gt: 0 } }, { $inc: { quantityAvailable: -1 } }, { new: true });
                if (!resource) {
                    res.status(409).json({ success: false, message: 'This resource is no longer available to reserve.' });
                    return;
                }
                if (resource.quantityAvailable === 0) {
                    resource.status = 'claimed';
                    await resource.save();
                }
            }
            request.status = status;
        }
        else if (request.status === 'accepted' && status === 'completed') {
            request.status = 'completed';
        }
        else {
            res.status(400).json({ success: false, message: 'This request has already been processed and cannot be changed to that status.' });
            return;
        }
        await request.save();
        res.status(200).json({ success: true, message: `Request ${status}.`, data: { request } });
    }
    catch (error) {
        console.error('Update resource request status error:', error);
        res.status(400).json({ success: false, message: 'Unable to update this request.' });
    }
};
exports.updateResourceRequestStatus = updateResourceRequestStatus;
//# sourceMappingURL=resourceRequestController.js.map