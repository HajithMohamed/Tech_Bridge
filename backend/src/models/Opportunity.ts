import mongoose, { Document, Schema } from 'mongoose';
import { eligibilityInput, type OpportunityEligibility } from '../services/opportunityPolicy';

export type OpportunityType =
  | 'job'
  | 'internship'
  | 'scholarship'
  | 'course'
  | 'freelance'
  | 'promotion'
  | 'workshop'
  | 'mentorship';

export interface IOpportunity extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  type: OpportunityType;
  requiredSkills: string[];
  location: string;
  workMode: 'remote' | 'on-site' | 'hybrid';
  providerId: mongoose.Types.ObjectId;
  status: 'draft' | 'open' | 'closed' | 'expired';
  views: number;
  applicationDeadline: Date;
  amount?: number;
  currency?: string;
  coverageType?: 'full' | 'partial' | 'tuition_only' | 'equipment_only' | 'stipend';
  eligibilityCriteria?: string[];
  numberOfAwards?: number;
  renewable?: boolean;
  scholarshipWithdrawnByAdmin?: boolean;
  opportunityWithdrawnByAdmin?: boolean;
  eligibility?: OpportunityEligibility;
  revision?: number;
  
  // Conditional fields
  duration?: string; // For internships, training
  isPaid?: boolean; // For internships
  preferredAcademicBackground?: string; // For internships
  
  startDate?: Date; // For training
  endDate?: Date; // For training
  fee?: number; // For training
  isFree?: boolean; // For training
  
  mentorName?: string; // For mentorship
  professionalField?: string; // For mentorship
  experience?: string; // For mentorship
  mentorshipType?: 'Career guidance' | 'Technical guidance' | 'Internship guidance' | 'Portfolio guidance'; // For mentorship
  availability?: string; // For mentorship
  
  paymentInfo?: string; // For jobs/projects (e.g. budget)
  contactMethod?: string; // General application instructions

  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new Schema<IOpportunity>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    type: {
      type: String,
      required: true,
      enum: ['job', 'internship', 'scholarship', 'course', 'freelance', 'promotion', 'workshop', 'mentorship'],
    },
    requiredSkills: [{ type: String, trim: true, maxlength: 60 }],
    location: { type: String, required: true, trim: true, maxlength: 120 },
    workMode: { type: String, required: true, enum: ['remote', 'on-site', 'hybrid'] },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['draft', 'open', 'closed', 'expired'], default: 'draft', index: true },
    views: { type: Number, default: 0, min: 0 },
    applicationDeadline: { type: Date, required: true, index: true },
    amount: {
      type: Number,
      min: 0,
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'LKR',
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
    },
    coverageType: {
      type: String,
      enum: ['full', 'partial', 'tuition_only', 'equipment_only', 'stipend'],
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
    },
    eligibilityCriteria: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
      validate: {
        validator(this: IOpportunity, value: string[]) {
          return this.type !== 'scholarship' || (Array.isArray(value) && value.length > 0);
        },
        message: 'Scholarships need at least one eligibility criterion',
      },
    },
    numberOfAwards: {
      type: Number,
      min: 1,
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
    },
    renewable: {
      type: Boolean,
      required: function (this: IOpportunity) { return this.type === 'scholarship'; },
    },
    scholarshipWithdrawnByAdmin: { type: Boolean },
    opportunityWithdrawnByAdmin: { type: Boolean },
    revision: { type: Number, min: 0 },
    eligibility: { type: new Schema<OpportunityEligibility>({ degrees: [{ type: String, enum: ['ict', 'et', 'bst', 'other'] }], institutions: [{ type: String, maxlength: 150 }], requiredSkills: [{ type: String, maxlength: 60 }], minStudyYear: { type: Number, min: 1, max: 6 }, maxStudyYear: { type: Number, min: 1, max: 6 } }, { _id: false }), validate: { validator: (value: (OpportunityEligibility & { toObject?: () => OpportunityEligibility }) | undefined) => { if (value === undefined) return true; try { eligibilityInput(value.toObject?.() ?? value); return true; } catch { return false; } }, message: 'Invalid structured eligibility requirements.' } },
    duration: { type: String, trim: true, maxlength: 120 },
    isPaid: { type: Boolean },
    preferredAcademicBackground: { type: String, trim: true, maxlength: 250 },
    startDate: { type: Date },
    endDate: { type: Date },
    fee: { type: Number, min: 0 },
    isFree: { type: Boolean },
    mentorName: { type: String, trim: true, maxlength: 120 },
    professionalField: { type: String, trim: true, maxlength: 160 },
    experience: { type: String, trim: true, maxlength: 120 },
    mentorshipType: { type: String, enum: ['Career guidance', 'Technical guidance', 'Internship guidance', 'Portfolio guidance'] },
    availability: { type: String, trim: true, maxlength: 250 },
    paymentInfo: { type: String, trim: true, maxlength: 500 },
    contactMethod: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

opportunitySchema.index({ status: 1, type: 1, applicationDeadline: 1 });
opportunitySchema.index({ status: 1, createdAt: -1, _id: -1 });
opportunitySchema.index({ providerId: 1, createdAt: -1, _id: -1 });
opportunitySchema.index({ createdAt: 1 });

const Opportunity = mongoose.model<IOpportunity>('Opportunity', opportunitySchema);

export default Opportunity;
