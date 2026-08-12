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
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    category: {
        type: String,
        required: true,
        enum: ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'development_board', 'electronic_component', 'project_equipment', 'other'],
    },
    accessMethods: {
        type: [{ type: String, enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'] }],
        validate: { validator: (value) => Array.isArray(value) && value.length > 0, message: 'Select at least one access method' },
        required: true,
    },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    availability: { type: String, enum: ['available', 'unavailable'], default: 'available', index: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    rentalRate: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'LKR', maxlength: 6 },
    providerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    views: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
resourceSchema.index({ availability: 1, category: 1, accessMethods: 1 });
const Resource = mongoose_1.default.model('Resource', resourceSchema);
exports.default = Resource;
//# sourceMappingURL=Resource.js.map