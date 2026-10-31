import mongoose, { Document, Schema } from 'mongoose';

export type ApplicationStatus = 'applied' | 'reviewed' | 'accepted' | 'rejected' | 'waitlisted';

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  appliedAt: Date;
  message?: string;
  justification: string;
  selfDeclaredNeed: 'low' | 'medium' | 'high';
  scholarshipVersion?: number;
  scholarshipRevision?: number;
  notificationRevision?: number;
  statusHistoryVersion?: number;
  waitlistedAt?: Date;
  awardedAt?: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    status: {
      type: String,
      enum: ['applied', 'reviewed', 'accepted', 'rejected', 'waitlisted'],
      default: 'applied',
      index: true,
    },
    appliedAt: { type: Date, default: Date.now, immutable: true, index: true },
    message: { type: String, trim: true, maxlength: 1000 },
    justification: { type: String, required: true, trim: true, minlength: 30, maxlength: 800 },
    selfDeclaredNeed: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    scholarshipVersion: { type: Number, enum: [1] },
    scholarshipRevision: { type: Number, min: 0 },
    notificationRevision: { type: Number, min: 0 },
    statusHistoryVersion: { type: Number, enum: [1] },
    waitlistedAt: Date,
    awardedAt: Date,
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// A student may apply to each opportunity once only.
applicationSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });
applicationSchema.index({ opportunityId: 1, status: 1, appliedAt: 1, _id: 1 });
applicationSchema.index({ status: 1, _id: 1 });

const Application = mongoose.model<IApplication>('Application', applicationSchema);

export default Application;
