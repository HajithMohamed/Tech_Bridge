"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProviderApplications = exports.updateApplicationStatus = exports.listOpportunityApplications = exports.listMyApplications = exports.createApplication = void 0;
const Application_1 = __importDefault(require("../models/Application"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const applicationStatuses = ['applied', 'reviewed', 'accepted', 'rejected'];
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';
/** POST /api/applications */
const createApplication = async (req, res) => {
    try {
        const { opportunityId, message } = req.body;
        const opportunity = await Opportunity_1.default.findOne({ _id: opportunityId, status: 'open' });
        if (!opportunity || opportunity.applicationDeadline <= new Date()) {
            res.status(404).json({ success: false, message: 'This opportunity is no longer accepting applications.' });
            return;
        }
        const existing = await Application_1.default.findOne({ studentId: req.user._id, opportunityId: opportunity._id });
        if (existing) {
            res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' });
            return;
        }
        const application = await Application_1.default.create({
            studentId: req.user._id,
            providerId: opportunity.providerId,
            opportunityId: opportunity._id,
            message: typeof message === 'string' ? message.trim() : undefined,
        });
        await application.populate('opportunityId', opportunitySelect);
        res.status(201).json({
            success: true,
            message: 'Application submitted',
            data: { application },
        });
    }
    catch (error) {
        console.error('Create application error:', error);
        res.status(400).json({ success: false, message: 'Unable to submit your application.' });
    }
};
exports.createApplication = createApplication;
/** GET /api/applications/mine */
const listMyApplications = async (req, res) => {
    try {
        const applications = await Application_1.default.find({ studentId: req.user._id })
            .populate('opportunityId', opportunitySelect)
            .sort({ appliedAt: -1 });
        res.status(200).json({ success: true, data: { applications } });
    }
    catch (error) {
        console.error('List student applications error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch your applications.' });
    }
};
exports.listMyApplications = listMyApplications;
/** GET /api/applications/opportunity/:id */
const listOpportunityApplications = async (req, res) => {
    try {
        const opportunity = await Opportunity_1.default.findOne({ _id: req.params.id, providerId: req.user._id });
        if (!opportunity) {
            res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it.' });
            return;
        }
        const applications = await Application_1.default.find({ opportunityId: opportunity._id })
            .populate('studentId', studentSelect)
            .sort({ appliedAt: -1 });
        res.status(200).json({ success: true, data: { applications } });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Unable to fetch applicants for this opportunity.' });
    }
};
exports.listOpportunityApplications = listOpportunityApplications;
/** PATCH /api/applications/:id/status */
const updateApplicationStatus = async (req, res) => {
    try {
        const status = req.body.status;
        if (!applicationStatuses.includes(status)) {
            res.status(400).json({ success: false, message: 'Status must be applied, reviewed, accepted, or rejected.' });
            return;
        }
        const application = await Application_1.default.findById(req.params.id);
        if (!application) {
            res.status(404).json({ success: false, message: 'Application not found.' });
            return;
        }
        const opportunity = await Opportunity_1.default.findOne({ _id: application.opportunityId, providerId: req.user._id });
        if (!opportunity) {
            res.status(403).json({ success: false, message: 'You cannot update this application.' });
            return;
        }
        application.status = status;
        await application.save();
        await application.populate('studentId', studentSelect);
        await application.populate('opportunityId', opportunitySelect);
        res.status(200).json({
            success: true,
            message: 'Application status updated',
            data: { application },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Unable to update this application.' });
    }
};
exports.updateApplicationStatus = updateApplicationStatus;
/** GET /api/applications/provider */
const listProviderApplications = async (req, res) => {
    try {
        const applications = await Application_1.default.find({ providerId: req.user._id })
            .populate('studentId', studentSelect)
            .populate('opportunityId', opportunitySelect)
            .sort({ appliedAt: -1 });
        res.status(200).json({ success: true, data: { applications } });
    }
    catch (error) {
        console.error('List provider applications error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch applications.' });
    }
};
exports.listProviderApplications = listProviderApplications;
//# sourceMappingURL=applicationController.js.map