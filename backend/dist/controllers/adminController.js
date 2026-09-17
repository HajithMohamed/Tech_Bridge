"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLog = exports.removeResource = exports.removeOpportunity = exports.resolveReport = exports.listReports = exports.reinstateUser = exports.suspendUser = exports.listUsers = exports.rejectProvider = exports.verifyProvider = exports.listProvidersForVerification = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const Report_1 = __importDefault(require("../models/Report"));
const Resource_1 = __importDefault(require("../models/Resource"));
const User_1 = __importDefault(require("../models/User"));
const audit = (adminId, action, targetType, targetId, reason) => AuditLog_1.default.create({ adminId, action, targetType, targetId, ...(reason ? { reason } : {}) });
const validId = (id) => mongoose_1.default.isValidObjectId(Array.isArray(id) ? id[0] : id);
const listProvidersForVerification = async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' && ['PENDING', 'VERIFIED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'PENDING';
        const providers = await User_1.default.find({ role: 'provider', 'providerProfile.verificationStatus': status })
            .select('fullName email accountStatus providerProfile createdAt')
            .sort({ createdAt: 1 });
        res.json({ success: true, data: { providers } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load the verification queue.' });
    }
};
exports.listProvidersForVerification = listProvidersForVerification;
const verifyProvider = async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            res.status(400).json({ success: false, message: 'Invalid provider ID.' });
            return;
        }
        const provider = await User_1.default.findOneAndUpdate({ _id: req.params.id, role: 'provider' }, { $set: { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED', 'providerProfile.rejectionReason': undefined } }, { new: true });
        if (!provider) {
            res.status(404).json({ success: false, message: 'Provider not found.' });
            return;
        }
        await audit(req.user._id, 'provider_verified', 'user', provider._id);
        res.json({ success: true, message: 'Provider verified. A notification can be sent by the notification service when enabled.', data: { provider } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to verify provider.' });
    }
};
exports.verifyProvider = verifyProvider;
const rejectProvider = async (req, res) => {
    try {
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (!validId(req.params.id) || reason.length < 3 || reason.length > 1000) {
            res.status(400).json({ success: false, message: 'Provide a rejection reason between 3 and 1000 characters.' });
            return;
        }
        const provider = await User_1.default.findOneAndUpdate({ _id: req.params.id, role: 'provider' }, { $set: { 'providerProfile.verified': false, 'providerProfile.verificationStatus': 'REJECTED', 'providerProfile.rejectionReason': reason } }, { new: true });
        if (!provider) {
            res.status(404).json({ success: false, message: 'Provider not found.' });
            return;
        }
        await audit(req.user._id, 'provider_rejected', 'user', provider._id, reason);
        res.json({ success: true, message: 'Provider rejected.', data: { provider } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to reject provider.' });
    }
};
exports.rejectProvider = rejectProvider;
const listUsers = async (req, res) => {
    try {
        const role = typeof req.query.role === 'string' && ['student', 'provider', 'admin'].includes(req.query.role) ? req.query.role : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const filter = { ...(role ? { role } : {}) };
        if (q)
            filter.$or = [{ fullName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }];
        const [users, total] = await Promise.all([
            User_1.default.find(filter).select('fullName email role accountStatus providerProfile.organizationName providerProfile.organizationType providerProfile.verificationStatus createdAt').sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20),
            User_1.default.countDocuments(filter),
        ]);
        res.json({ success: true, data: { users, page, total, pages: Math.max(1, Math.ceil(total / 20)) } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load users.' });
    }
};
exports.listUsers = listUsers;
const changeAccountStatus = (status, action) => async (req, res) => {
    try {
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : undefined;
        if (!validId(req.params.id) || (status === 'suspended' && (!reason || reason.length < 3))) {
            res.status(400).json({ success: false, message: status === 'suspended' ? 'Provide a suspension reason.' : 'Invalid user ID.' });
            return;
        }
        if (req.user._id.toString() === req.params.id) {
            res.status(400).json({ success: false, message: 'You cannot change your own account status.' });
            return;
        }
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { accountStatus: status }, { new: true });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        await audit(req.user._id, action, 'user', user._id, reason);
        res.json({ success: true, message: `Account ${status === 'suspended' ? 'suspended' : 'reinstated'}.`, data: { user } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to update account status.' });
    }
};
exports.suspendUser = changeAccountStatus('suspended', 'user_suspended');
exports.reinstateUser = changeAccountStatus('active', 'user_reinstated');
const listReports = async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' && ['open', 'reviewed', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
        const reports = await Report_1.default.find({ status }).populate('reporterId', 'fullName email role').sort({ createdAt: -1 });
        res.json({ success: true, data: { reports } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load reports.' });
    }
};
exports.listReports = listReports;
const resolveReport = async (req, res) => {
    try {
        const { status, resolutionNote, removeTarget } = req.body;
        if (!validId(req.params.id) || !['reviewed', 'dismissed'].includes(status || '')) {
            res.status(400).json({ success: false, message: 'Select reviewed or dismissed.' });
            return;
        }
        const report = await Report_1.default.findById(req.params.id);
        if (!report) {
            res.status(404).json({ success: false, message: 'Report not found.' });
            return;
        }
        report.status = status;
        report.resolutionNote = typeof resolutionNote === 'string' ? resolutionNote.trim().slice(0, 1000) : undefined;
        await report.save();
        if (removeTarget && report.targetType === 'opportunity') {
            await Opportunity_1.default.findByIdAndDelete(report.targetId);
            await audit(req.user._id, 'opportunity_removed_from_report', 'opportunity', report.targetId, report.resolutionNote);
        }
        else if (removeTarget && report.targetType === 'resource') {
            await Resource_1.default.findByIdAndDelete(report.targetId);
            await audit(req.user._id, 'resource_removed_from_report', 'resource', report.targetId, report.resolutionNote);
        }
        else {
            await audit(req.user._id, 'report_resolved', 'user', report.reporterId, report.resolutionNote);
        }
        res.json({ success: true, message: 'Report resolved.', data: { report } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to resolve report.' });
    }
};
exports.resolveReport = resolveReport;
const removeListing = (targetType) => async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            res.status(400).json({ success: false, message: 'Invalid listing ID.' });
            return;
        }
        const listing = targetType === 'opportunity'
            ? await Opportunity_1.default.findByIdAndDelete(req.params.id)
            : await Resource_1.default.findByIdAndDelete(req.params.id);
        if (!listing) {
            res.status(404).json({ success: false, message: 'Listing not found.' });
            return;
        }
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined;
        await audit(req.user._id, `${targetType}_removed`, targetType, listing._id, reason);
        res.json({ success: true, message: `${targetType === 'opportunity' ? 'Opportunity' : 'Resource'} removed.` });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to remove listing.' });
    }
};
exports.removeOpportunity = removeListing('opportunity');
exports.removeResource = removeListing('resource');
const listAuditLog = async (req, res) => {
    try {
        const targetType = typeof req.query.targetType === 'string' && ['user', 'opportunity', 'resource'].includes(req.query.targetType) ? req.query.targetType : undefined;
        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const filter = targetType ? { targetType } : {};
        const [entries, total] = await Promise.all([
            AuditLog_1.default.find(filter).populate('adminId', 'fullName email').sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30),
            AuditLog_1.default.countDocuments(filter),
        ]);
        res.json({ success: true, data: { entries, page, total, pages: Math.max(1, Math.ceil(total / 30)) } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to load audit log.' });
    }
};
exports.listAuditLog = listAuditLog;
//# sourceMappingURL=adminController.js.map