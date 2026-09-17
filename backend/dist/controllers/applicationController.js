"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProviderApplications = exports.updateApplicationStatus = exports.listOpportunityApplications = exports.listMyApplications = exports.createApplication = void 0;
const Application_1 = __importDefault(require("../models/Application"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const User_1 = __importDefault(require("../models/User"));
const priorityEngine_1 = require("../utils/priorityEngine");
const applicationStatuses = ['applied', 'reviewed', 'accepted', 'rejected'];
const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const opportunitySelect = 'title type location workMode applicationDeadline providerId status';
const currentAcademicYearStart = () => new Date(new Date().getFullYear(), 0, 1);
const idString = (value) => {
    if (value && typeof value === 'object' && '_id' in value)
        return String(value._id);
    return String(value);
};
const enrichApplications = async (applications, opportunity) => {
    if (!applications.length)
        return [];
    const studentIds = applications.map((application) => idString(application.studentId));
    const [students, acceptedBenefits] = await Promise.all([
        User_1.default.find({ _id: { $in: studentIds } }),
        Application_1.default.aggregate([
            { $match: { status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, studentId: { $in: studentIds } } },
            { $lookup: { from: 'opportunities', localField: 'opportunityId', foreignField: '_id', as: 'opportunity' } },
            { $unwind: '$opportunity' },
            { $match: { 'opportunity.type': opportunity.type } },
            { $group: { _id: '$studentId', count: { $sum: 1 } } },
        ]),
    ]);
    const studentMap = new Map(students.map((student) => [student._id.toString(), student]));
    const benefitMap = new Map(acceptedBenefits.map((item) => [item._id.toString(), item.count]));
    const dates = applications.map((application) => application.appliedAt.getTime());
    const firstAt = new Date(Math.min(...dates));
    const lastAt = new Date(Math.max(...dates));
    const acceptedCount = applications.filter((application) => application.status === 'accepted').length;
    return applications.map((application) => ({
        ...application.toObject(),
        ...(0, priorityEngine_1.applicationPriority)(application, opportunity, studentMap.get(idString(application.studentId)), benefitMap.get(idString(application.studentId)) || 0, firstAt, lastAt, acceptedCount),
    })).sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime());
};
/** POST /api/applications */
const createApplication = async (req, res) => {
    try {
        const { opportunityId, message, justification, selfDeclaredNeed } = req.body;
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
        if (typeof justification !== 'string' || justification.trim().length < 30 || justification.trim().length > 800) {
            res.status(400).json({ success: false, message: 'Please provide a justification between 30 and 800 characters.' });
            return;
        }
        if (!['low', 'medium', 'high'].includes(selfDeclaredNeed)) {
            res.status(400).json({ success: false, message: 'Select your declared need level.' });
            return;
        }
        const application = await Application_1.default.create({
            studentId: req.user._id,
            providerId: opportunity.providerId,
            opportunityId: opportunity._id,
            message: typeof message === 'string' ? message.trim() : undefined,
            justification: justification.trim(),
            selfDeclaredNeed,
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
            .sort({ appliedAt: 1 });
        const enriched = await enrichApplications(applications, opportunity);
        res.status(200).json({ success: true, data: { applications: enriched } });
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
        if (status === 'accepted' && opportunity.type === 'scholarship') {
            const [acceptedForOpportunity, existingScholarships] = await Promise.all([
                Application_1.default.countDocuments({ opportunityId: opportunity._id, status: 'accepted', _id: { $ne: application._id } }),
                Application_1.default.find({ studentId: application.studentId, status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, _id: { $ne: application._id } }).populate('opportunityId', 'type'),
            ]);
            if (acceptedForOpportunity >= (opportunity.numberOfAwards || 1)) {
                res.status(409).json({ success: false, message: 'This scholarship has reached its number of awards.' });
                return;
            }
            if (existingScholarships.some((item) => item.opportunityId?.type === 'scholarship')) {
                res.status(409).json({ success: false, message: 'This student already holds an accepted scholarship for this academic year.' });
                return;
            }
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
            .sort({ appliedAt: 1 });
        const opportunities = await Opportunity_1.default.find({ _id: { $in: applications.map((application) => idString(application.opportunityId)) } });
        const enriched = (await Promise.all(opportunities.map(async (opportunity) => {
            const group = applications.filter((application) => idString(application.opportunityId) === opportunity._id.toString());
            return enrichApplications(group, opportunity);
        }))).flat().sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
        res.status(200).json({ success: true, data: { applications: enriched } });
    }
    catch (error) {
        console.error('List provider applications error:', error);
        res.status(500).json({ success: false, message: 'Unable to fetch applications.' });
    }
};
exports.listProviderApplications = listProviderApplications;
//# sourceMappingURL=applicationController.js.map