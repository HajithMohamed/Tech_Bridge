import mongoose, { Document, Schema } from 'mongoose';

export type ApplicationStatus = 'submitted' | 'reviewing' | 'accepted' | 'rejected';

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  opportunityId: mongoose.Types.ObjectId;
  applicantId: mongoose.Types.ObjectId;
  message?: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    applicantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['submitted', 'reviewing', 'accepted', 'rejected'],
      default: 'submitted',
      index: true,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ opportunityId: 1, applicantId: 1 }, { unique: true });

const Application = mongoose.model<IApplication>('Application', applicationSchema);

export default Application;
