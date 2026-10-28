import mongoose, { Document, Schema } from 'mongoose';
import { ResourceAccessType, ResourceCategory } from './Resource';

export type ResourceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'waitlisted' | 'cancelled';

export interface IResourceRequest extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  resourceId: mongoose.Types.ObjectId;
  requestedAccessType: ResourceAccessType;
  resourceCategory: ResourceCategory;
  durationOrTerms?: string;
  message?: string;
  justification: string;
  selfDeclaredNeed: 'low' | 'medium' | 'high';
  status: ResourceRequestStatus;
  lifecycleVersion?: number;
  revision?: number;
  requestedStartAt?: Date;
  requestedReturnAt?: Date;
  waitlistedAt?: Date;
  returnRequestedAt?: Date;
  returnedAt?: Date;
  inventoryRestoredAt?: Date;
  allocation?: { returnRequired: boolean; accessType: ResourceAccessType; inventoryReserved: boolean; startAt?: Date; dueAt?: Date };
  prioritySnapshot?: { priorityScore: number; priorityReasons: string[]; components: { need: number; fit: number; benefits: number; timing: number }; calculatedAt: Date };
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
    resourceCategory: { type: String, required: true, enum: ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'], index: true },
    durationOrTerms: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 1000 },
    justification: { type: String, required: true, trim: true, minlength: 30, maxlength: 800 },
    selfDeclaredNeed: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed', 'waitlisted', 'cancelled'],
      default: 'pending',
      index: true,
    },
    lifecycleVersion: { type: Number, enum: [1] }, revision: { type: Number, min: 0 },
    requestedStartAt: Date, requestedReturnAt: Date, waitlistedAt: Date,
    returnRequestedAt: Date, returnedAt: Date, inventoryRestoredAt: Date,
    allocation: { type: new Schema({ returnRequired: { type: Boolean, required: true }, accessType: { type: String, required: true, enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'] }, inventoryReserved: { type: Boolean, required: true }, startAt: Date, dueAt: Date }, { _id: false }), default: undefined },
    prioritySnapshot: { type: new Schema({ priorityScore: { type: Number, min: 0, max: 100, required: true }, priorityReasons: [String], components: { need: Number, fit: Number, benefits: Number, timing: Number }, calculatedAt: Date }, { _id: false }), default: undefined },
  },
  { timestamps: true }
);

// Prevent duplicate pending requests for the same resource from the same student
resourceRequestSchema.index(
  { studentId: 1, resourceId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
resourceRequestSchema.index({ resourceId: 1, status: 1, createdAt: 1, _id: 1 });
resourceRequestSchema.index({ status: 1, 'allocation.dueAt': 1 });

const ResourceRequest = mongoose.model<IResourceRequest>('ResourceRequest', resourceRequestSchema);

export default ResourceRequest;
