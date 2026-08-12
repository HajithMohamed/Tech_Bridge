import mongoose, { Document, Schema } from 'mongoose';
import { ResourceAccessType } from './Resource';

export type ResourceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface IResourceRequest extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  resourceId: mongoose.Types.ObjectId;
  requestedAccessType: ResourceAccessType;
  durationOrTerms?: string;
  message?: string;
  status: ResourceRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const resourceRequestSchema = new Schema<IResourceRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    requestedAccessType: {
      type: String,
      required: true,
      enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'],
    },
    durationOrTerms: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate pending requests for the same resource from the same student
resourceRequestSchema.index(
  { studentId: 1, resourceId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const ResourceRequest = mongoose.model<IResourceRequest>('ResourceRequest', resourceRequestSchema);

export default ResourceRequest;
