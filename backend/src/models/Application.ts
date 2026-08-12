import mongoose, { Document, Schema } from 'mongoose';

export type ApplicationStatus = 'applied' | 'reviewed' | 'accepted' | 'rejected';

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  appliedAt: Date;
  message?: string;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    status: {
      type: String,
      enum: ['applied', 'reviewed', 'accepted', 'rejected'],
      default: 'applied',
      index: true,
    },
    appliedAt: { type: Date, default: Date.now, immutable: true, index: true },
    message: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// A student may apply to each opportunity once only.
applicationSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });

const Application = mongoose.model<IApplication>('Application', applicationSchema);

export default Application;
