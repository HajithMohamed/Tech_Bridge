import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type OrganizationType =
  | 'company'
  | 'training_org'
  | 'scholarship_org'
  | 'resource_provider'
  | 'local_business'
  | 'alumni'
  | 'faculty'
  | 'ngo'
  | 'individual';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  password: string;
  role: 'student' | 'provider' | 'admin';
  studentProfile?: {
    institution: string;
    degree: 'ICT' | 'ET' | 'BST' | 'other';
    studyYear: number;
    location?: string;
    skills: string[];
    careerGoal?: string;
    availabilityHours?: number;
    preferredWorkType?: 'remote' | 'on-site' | 'hybrid' | 'flexible';
    learningGoals?: string[];
    certifications?: string[];
    portfolioUrl?: string;
  };
  providerProfile?: {
    organizationName: string;
    organizationType: OrganizationType;
    verified: boolean;
    verificationStatus: 'PENDING' | 'VERIFIED';
    contactEmail: string;
    contactPerson: string;
    phone: string;
    location: string;
    website?: string;
    logoUrl?: string;
    description?: string;
    verificationDocumentName?: string;
    opportunityCategories: string[];
    resourceAccessMethods?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
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
        enum: ['company', 'training_org', 'scholarship_org', 'resource_provider', 'local_business', 'alumni', 'faculty', 'ngo', 'individual'],
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
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
