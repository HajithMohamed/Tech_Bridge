import mongoose, { Schema, Types } from 'mongoose';
import type { ApplicationStatus } from './Application';

export interface SavedOpportunityRecord { studentId: Types.ObjectId; opportunityId: Types.ObjectId; createdAt: Date }
const savedSchema = new Schema<SavedOpportunityRecord>({ studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true } }, { timestamps: { createdAt: true, updatedAt: false } });
savedSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });
savedSchema.index({ studentId: 1, createdAt: -1, _id: -1 });
savedSchema.index({ opportunityId: 1 });
export const SavedOpportunity = mongoose.model<SavedOpportunityRecord>('SavedOpportunity', savedSchema);

export interface ApplicationEventRecord {
  applicationId: Types.ObjectId; opportunityId: Types.ObjectId; studentId: Types.ObjectId; providerId: Types.ObjectId;
  actorId: Types.ObjectId; revision: number; action: 'submitted' | 'decision'; fromStatus?: ApplicationStatus;
  toStatus: ApplicationStatus; reason: string; createdAt: Date;
}
const eventSchema = new Schema<ApplicationEventRecord>({
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true }, opportunityId: { type: Schema.Types.ObjectId, required: true },
  studentId: { type: Schema.Types.ObjectId, required: true }, providerId: { type: Schema.Types.ObjectId, required: true }, actorId: { type: Schema.Types.ObjectId, required: true },
  revision: { type: Number, required: true, min: 0 }, action: { type: String, enum: ['submitted', 'decision'], required: true },
  fromStatus: { type: String, enum: ['applied', 'reviewed', 'accepted', 'rejected'] }, toStatus: { type: String, enum: ['applied', 'reviewed', 'accepted', 'rejected'], required: true },
  reason: { type: String, required: true, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ applicationId: 1, revision: 1 }, { unique: true });
eventSchema.index({ applicationId: 1, createdAt: -1, _id: -1 });
export const ApplicationEvent = mongoose.model<ApplicationEventRecord>('ApplicationEvent', eventSchema);
