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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const userSchema = new mongoose_1.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters'],
        maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,
    },
    role: {
        type: String,
        enum: ['student', 'provider', 'admin'],
        default: 'student',
    },
    studentProfile: {
        institution: { type: String, trim: true },
        degree: { type: String, enum: ['ICT', 'ET', 'BST', 'other'] },
        studyYear: { type: Number, min: 1, max: 6 },
        location: { type: String, trim: true, maxlength: 100 },
        skills: [{ type: String, trim: true, maxlength: 50 }],
        careerGoal: { type: String, trim: true, maxlength: 150 },
        availabilityHours: { type: Number, min: 0, max: 168 },
        preferredWorkType: { type: String, enum: ['remote', 'on-site', 'hybrid', 'flexible'] },
        learningGoals: [{ type: String, trim: true, maxlength: 100 }],
        certifications: [{ type: String, trim: true, maxlength: 160 }],
        portfolioUrl: { type: String, trim: true, maxlength: 500 },
    },
    providerProfile: {
        organizationName: { type: String, trim: true, maxlength: 150 },
        organizationType: {
            type: String,
            enum: ['company', 'training_org', 'scholarship_org', 'ngo', 'individual'],
        },
        verified: { type: Boolean, default: false },
        verificationStatus: { type: String, enum: ['PENDING', 'VERIFIED'], default: 'PENDING' },
        contactEmail: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid contact email'],
        },
        contactPerson: { type: String, trim: true, maxlength: 100 },
        phone: { type: String, trim: true, maxlength: 30 },
        location: { type: String, trim: true, maxlength: 100 },
        website: { type: String, trim: true, maxlength: 200 },
        logoUrl: { type: String, trim: true, maxlength: 500 },
        description: { type: String, trim: true, maxlength: 1000 },
        verificationDocumentName: { type: String, trim: true, maxlength: 255 },
        opportunityCategories: [{ type: String, trim: true }],
        resourceAccessMethods: [{ type: String, trim: true }],
    },
}, { timestamps: true });
userSchema.pre('save', async function () {
    if (!this.isModified('password'))
        return;
    const salt = await bcryptjs_1.default.genSalt(12);
    this.password = await bcryptjs_1.default.hash(this.password, salt);
});
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcryptjs_1.default.compare(candidatePassword, this.password);
};
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
//# sourceMappingURL=User.js.map