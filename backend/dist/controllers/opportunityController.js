"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOpportunity = exports.updateOpportunity = exports.getOpportunity = exports.listMyOpportunities = exports.listScholarships = exports.listOpportunities = exports.createOpportunity = void 0;
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const Application_1 = __importDefault(require("../models/Application"));
const opportunityTypes = [
    'job',
    'internship',
    'scholarship',
    'course',
    'freelance',
    'workshop',
    'mentorship',
];
const workModes = ['remote', 'on-site', 'hybrid'];
const coverageTypes = ['full', 'partial', 'tuition_only', 'equipment_only', 'stipend'];
const opportunityStatuses = ['draft', 'open', 'closed', 'expired'];
const editableFields = [
    'title',
    'description',
    'type',
    'requiredSkills',
    'location',
    'workMode',
    'status',
    'applicationDeadline',
    'amount',
    'currency',
    'coverageType',
    'eligibilityCriteria',
    'numberOfAwards',
    'renewable',
    'duration',
    'isPaid',
    'preferredAcademicBackground',
    'startDate',
    'endDate',
    'fee',
    'isFree',
    'mentorName',
    'professionalField',
    'experience',
    'mentorshipType',
    'availability',
    'paymentInfo',
    'contactMethod'
];
const scholarshipFields = ['amount', 'currency', 'coverageType', 'eligibilityCriteria', 'numberOfAwards', 'renewable'];
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified';
const isScholarshipProvider = (req) => {
    const type = req.user?.providerProfile?.organizationType;
    return type === 'scholarship_org' || type === 'ngo';
};
const hasValidDeadline = (deadline) => {
    const parsed = new Date(String(deadline));
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
};
const expireOpportunities = async () => {
    await Opportunity_1.default.updateMany({ status: 'open', applicationDeadline: { $lt: new Date() } }, { $set: { status: 'expired' } });
};
const validateOpportunity = (values) => {
    if (typeof values.title !== 'string' || values.title.trim().length < 3)
        return 'Title must be at least 3 characters.';
    if (typeof values.description !== 'string' || values.description.trim().length < 20)
        return 'Description must be at least 20 characters.';
    if (!opportunityTypes.includes(values.type))
        return 'Select a valid opportunity type.';
    if (!Array.isArray(values.requiredSkills))
        return 'requiredSkills must be an array.';
    if (typeof values.location !== 'string' || !values.location.trim())
        return 'Location is required.';
    if (!workModes.includes(values.workMode))
        return 'Select a valid work mode.';
    if (!opportunityStatuses.includes(values.status))
        return 'Select a valid opportunity status.';
    if (!hasValidDeadline(values.applicationDeadline))
        return 'Application deadline must be a future date.';
    if (values.type === 'scholarship') {
        if (typeof values.amount !== 'number' || values.amount < 0)
            return 'Scholarships require a valid amount.';
        if (typeof values.currency !== 'string' || !values.currency.trim())
            return 'Scholarships require a currency.';
        if (!coverageTypes.includes(values.coverageType))
            return 'Scholarships require a valid coverage type.';
        if (!Array.isArray(values.eligibilityCriteria) || values.eligibilityCriteria.length === 0 || values.eligibilityCriteria.some(item => typeof item !== 'string' || !item.trim()))
            return 'Scholarships require at least one eligibility criterion.';
        if (!Number.isInteger(values.numberOfAwards) || values.numberOfAwards < 1)
            return 'Scholarships require at least one award.';
        if (typeof values.renewable !== 'boolean')
            return 'Scholarships must state whether the award is renewable.';
    }
    return null;
};
const opportunityPayload = (body) => {
    const payload = {};
    editableFields.forEach((field) => {
        if (body[field] !== undefined)
            payload[field] = body[field];
    });
    return payload;
};
/** POST /api/opportunities */
const createOpportunity = async (req, res) => {
    try {
        const payload = opportunityPayload(req.body);
        const validationError = validateOpportunity(payload);
        if (validationError) {
            res.status(400).json({ success: false, message: validationError });
            return;
        }
        if (payload.type === 'scholarship' && !isScholarshipProvider(req)) {
            res.status(403).json({
                success: false,
                message: 'Only verified scholarship organizations and NGOs can publish scholarships.',
            });
            return;
        }
        const opportunity = await Opportunity_1.default.create({ ...payload, providerId: req.user._id });
        await opportunity.populate('providerId', providerSelect);
        res.status(201).json({ success: true, message: 'Opportunity created', data: { opportunity } });
    }
    catch (error) {
        console.error('Create opportunity error:', error);
        res.status(500).json({ success: false, message: 'Server error creating opportunity' });
    }
};
exports.createOpportunity = createOpportunity;
/** GET /api/opportunities */
const listOpportunities = async (req, res) => {
    try {
        await expireOpportunities();
        const { type, skill, workMode } = req.query;
        const filter = { status: 'open' };
        if (typeof type === 'string' && opportunityTypes.includes(type))
            filter.type = type;
        if (typeof workMode === 'string' && workModes.includes(workMode))
            filter.workMode = workMode;
        if (typeof skill === 'string' && skill.trim()) {
            const escaped = skill.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.requiredSkills = { $regex: escaped, $options: 'i' };
        }
        const opportunities = await Opportunity_1.default.find(filter)
            .populate('providerId', providerSelect)
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { opportunities } });
    }
    catch (error) {
        console.error('List opportunities error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching opportunities' });
    }
};
exports.listOpportunities = listOpportunities;
/** GET /api/opportunities/scholarships */
const listScholarships = async (_req, res) => {
    try {
        await expireOpportunities();
        const opportunities = await Opportunity_1.default.find({ status: 'open', type: 'scholarship' })
            .populate('providerId', providerSelect)
            .sort({ applicationDeadline: 1 });
        res.status(200).json({ success: true, data: { opportunities } });
    }
    catch (error) {
        console.error('List scholarships error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching scholarships' });
    }
};
exports.listScholarships = listScholarships;
/** GET /api/opportunities/mine */
const listMyOpportunities = async (req, res) => {
    try {
        await expireOpportunities();
        const opportunities = await Opportunity_1.default.find({ providerId: req.user._id }).sort({ createdAt: -1 });
        const enriched = await Promise.all(opportunities.map(async (opportunity) => ({
            ...opportunity.toObject(),
            applicationCount: await Application_1.default.countDocuments({ opportunityId: opportunity._id }),
        })));
        res.status(200).json({ success: true, data: { opportunities: enriched } });
    }
    catch (error) {
        console.error('List provider opportunities error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching your opportunities' });
    }
};
exports.listMyOpportunities = listMyOpportunities;
/** GET /api/opportunities/:id */
const getOpportunity = async (req, res) => {
    try {
        await expireOpportunities();
        const opportunity = await Opportunity_1.default.findOneAndUpdate({ _id: req.params.id, status: 'open' }, { $inc: { views: 1 } }, { new: true })
            .populate('providerId', providerSelect);
        if (!opportunity) {
            res.status(404).json({ success: false, message: 'Open opportunity not found' });
            return;
        }
        res.status(200).json({ success: true, data: { opportunity } });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Invalid opportunity ID' });
    }
};
exports.getOpportunity = getOpportunity;
/** PUT /api/opportunities/:id */
const updateOpportunity = async (req, res) => {
    try {
        const opportunity = await Opportunity_1.default.findOne({ _id: req.params.id, providerId: req.user._id });
        if (!opportunity) {
            res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
            return;
        }
        const payload = opportunityPayload(req.body);
        const values = { ...opportunity.toObject(), ...payload };
        const validationError = validateOpportunity(values);
        if (validationError) {
            res.status(400).json({ success: false, message: validationError });
            return;
        }
        if (values.type === 'scholarship' && !isScholarshipProvider(req)) {
            res.status(403).json({
                success: false,
                message: 'Only verified scholarship organizations and NGOs can publish scholarships.',
            });
            return;
        }
        if (payload.status === 'expired') {
            res.status(400).json({ success: false, message: 'Expired status is assigned automatically when a deadline passes.' });
            return;
        }
        opportunity.set(payload);
        if (opportunity.type !== 'scholarship') {
            scholarshipFields.forEach((field) => opportunity.set(field, undefined));
        }
        await opportunity.save();
        await opportunity.populate('providerId', providerSelect);
        res.status(200).json({ success: true, message: 'Opportunity updated', data: { opportunity } });
    }
    catch (error) {
        console.error('Update opportunity error:', error);
        res.status(400).json({ success: false, message: 'Unable to update this opportunity' });
    }
};
exports.updateOpportunity = updateOpportunity;
/** DELETE /api/opportunities/:id */
const deleteOpportunity = async (req, res) => {
    try {
        const opportunity = await Opportunity_1.default.findOneAndDelete({ _id: req.params.id, providerId: req.user._id });
        if (!opportunity) {
            res.status(404).json({ success: false, message: 'Opportunity not found or you do not own it' });
            return;
        }
        res.status(200).json({ success: true, message: 'Opportunity deleted' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Invalid opportunity ID' });
    }
};
exports.deleteOpportunity = deleteOpportunity;
//# sourceMappingURL=opportunityController.js.map