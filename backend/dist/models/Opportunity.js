"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const opportunitySchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    type: {
        type: String,
        required: true,
        enum: ['job', 'internship', 'scholarship', 'course', 'freelance', 'workshop'],
    },
    requiredSkills: [{ type: String, trim: true, maxlength: 60 }],
    location: { type: String, required: true, trim: true, maxlength: 120 },
    workMode: { type: String, required: true, enum: ['remote', 'on-site', 'hybrid'] },
    providerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['draft', 'open', 'closed', 'expired'], default: 'draft', index: true },
    views: { type: Number, default: 0, min: 0 },
    applicationDeadline: { type: Date, required: true, index: true },
    amount: {
        type: Number,
        min: 0,
        required: function () { return this.type === 'scholarship'; },
    },
    currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: 'LKR',
        required: function () { return this.type === 'scholarship'; },
    },
    coverageType: {
        type: String,
        enum: ['full', 'partial', 'tuition_only', 'equipment_only', 'stipend'],
        required: function () { return this.type === 'scholarship'; },
    },
    eligibilityCriteria: {
        type: [{ type: String, trim: true, maxlength: 300 }],
        required: function () { return this.type === 'scholarship'; },
        validate: {
            validator(value) {
                return this.type !== 'scholarship' || (Array.isArray(value) && value.length > 0);
            },
            message: 'Scholarships need at least one eligibility criterion',
        },
    },
    numberOfAwards: {
        type: Number,
        min: 1,
        required: function () { return this.type === 'scholarship'; },
    },
    renewable: {
        type: Boolean,
        required: function () { return this.type === 'scholarship'; },
    },
}, { timestamps: true });
opportunitySchema.index({ status: 1, type: 1, applicationDeadline: 1 });
const Opportunity = mongoose_1.default.model('Opportunity', opportunitySchema);
exports.default = Opportunity;
//# sourceMappingURL=Opportunity.js.map