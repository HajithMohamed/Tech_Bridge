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
const resourceSchema = new mongoose_1.Schema({
    itemName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160, index: true },
    category: {
        type: String,
        required: true,
        enum: ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'],
        index: true,
    },
    condition: { type: String, enum: ['new', 'used_good', 'used_fair'] },
    accessType: {
        type: String,
        required: true,
        enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'],
        index: true,
    },
    listedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerOrgVerified: { type: Boolean, required: true, default: false, index: true },
    quantityAvailable: { type: Number, required: true, min: 0, default: 1 },
    status: { type: String, enum: ['available', 'claimed'], default: 'available', index: true },
    accessDetails: {
        borrowShare: {
            borrowDurationDays: { type: Number, min: 1 },
            pickupLocation: { type: String, trim: true, maxlength: 200 },
            returnCondition: { type: String, trim: true, maxlength: 1000 },
        },
        rent: {
            pricePerMonth: { type: Number, min: 0 },
            currency: { type: String, trim: true, uppercase: true, maxlength: 6 },
            minRentalMonths: { type: Number, min: 1 },
            securityDeposit: { type: Number, min: 0 },
        },
        installment: {
            totalPrice: { type: Number, min: 0 },
            downPayment: { type: Number, min: 0 },
            monthlyInstallmentAmount: { type: Number, min: 0 },
            numberOfMonths: { type: Number, min: 1 },
            lateFeePolicy: { type: String, trim: true, maxlength: 500 },
        },
        interestFree: {
            totalPrice: { type: Number, min: 0 },
            monthlyInstallmentAmount: { type: Number, min: 0 },
            numberOfMonths: { type: Number, min: 1 },
            eligibilityCriteria: [{ type: String, trim: true, maxlength: 300 }],
            repaymentStartDate: { type: Date },
            interestRate: { type: Number, required: true, default: 0, min: 0, max: 0 },
        },
        sponsorship: {
            eligibilityCriteria: [{ type: String, trim: true, maxlength: 300 }],
            applicationDeadline: { type: Date },
            numberOfUnitsAvailable: { type: Number, min: 1 },
            sponsorOrganization: { type: String, trim: true, maxlength: 160 },
        },
        donation: {
            itemAgeYears: { type: Number, min: 0, max: 100 },
            conditionNotes: { type: String, trim: true, maxlength: 1000 },
            pickupOrDeliveryMethod: { type: String, trim: true, maxlength: 100 },
            claimDeadline: { type: Date },
        },
    },
}, { timestamps: true });
resourceSchema.index({ status: 1, accessType: 1, category: 1, createdAt: -1 });
const Resource = mongoose_1.default.model('Resource', resourceSchema);
exports.default = Resource;
//# sourceMappingURL=Resource.js.map