"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateResourceRequestStatus = exports.listProviderResourceRequests = exports.listMyResourceRequests = exports.createResourceRequest = void 0;
const ResourceRequest_1 = __importDefault(require("../models/ResourceRequest"));
const Resource_1 = __importDefault(require("../models/Resource"));
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const resourceSelect = 'itemName category condition accessType quantityAvailable status';
/** POST /api/resource-requests */
const createResourceRequest = async (req, res) => {
    try {
        const { resourceId, requestedAccessType, durationOrTerms, message } = req.body;
        const resource = await Resource_1.default.findOne({ _id: resourceId, status: 'available' });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource not found or no longer available.' });
            return;
        }
        if (resource.accessType !== requestedAccessType) {
            res.status(400).json({ success: false, message: 'Invalid access type requested for this resource.' });
            return;
        }
        const existing = await ResourceRequest_1.default.findOne({ studentId: req.user._id, resourceId: resource._id, status: 'pending' });
        if (existing) {
            res.status(409).json({ success: false, message: 'You already have a pending request for this resource.' });
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
            .populate('providerId', 'fullName email')
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
/** PATCH /api/resource-requests/:id/status */
const updateResourceRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'rejected', 'completed'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status update.' });
            return;
        }
        const request = await ResourceRequest_1.default.findOneAndUpdate({ _id: req.params.id, providerId: req.user._id }, { status }, { new: true });
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found.' });
            return;
        }
        res.status(200).json({ success: true, message: `Request ${status}.`, data: { request } });
    }
    catch (error) {
        console.error('Update resource request status error:', error);
        res.status(400).json({ success: false, message: 'Unable to update this request.' });
    }
};
exports.updateResourceRequestStatus = updateResourceRequestStatus;
//# sourceMappingURL=resourceRequestController.js.map