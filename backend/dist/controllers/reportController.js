"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReport = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Report_1 = __importDefault(require("../models/Report"));
const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason } = req.body;
        if (!['opportunity', 'resource', 'user', 'message', 'promotion_request'].includes(targetType) || !mongoose_1.default.isValidObjectId(targetId) || typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 1000) {
            res.status(400).json({ success: false, message: 'Provide a valid target and a reason between 5 and 1000 characters.' });
            return;
        }
        const report = await Report_1.default.create({ reporterId: req.user._id, targetType, targetId, reason: reason.trim() });
        res.status(201).json({ success: true, message: 'Report submitted for review.', data: { report } });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ success: false, message: 'You have already reported this item.' });
            return;
        }
        res.status(500).json({ success: false, message: 'Unable to submit report.' });
    }
};
exports.createReport = createReport;
//# sourceMappingURL=reportController.js.map