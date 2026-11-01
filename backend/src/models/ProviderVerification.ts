import mongoose, { Schema, Types } from 'mongoose';

export type VerificationStatus = 'PENDING' | 'NEEDS_INFO' | 'REJECTED' | 'VERIFIED';
export const decisionActions = ['verified', 'rejected', 'more_info'] as const;
export interface VerificationDocumentRecord {
  providerId: Types.ObjectId; fileName: string; contentType: string; size: number;
  data: Buffer; sha256: string; createdAt: Date;
}
const documentSchema = new Schema<VerificationDocumentRecord>({
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true, maxlength: 120 },
  contentType: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], required: true },
  size: { type: Number, min: 1, max: 2 * 1024 * 1024, required: true },
  data: { type: Buffer, required: true, select: false },
  sha256: { type: String, required: true, select: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
documentSchema.index({ providerId: 1, createdAt: -1 });

export interface VerificationEventRecord {
  providerId: Types.ObjectId; actorId: Types.ObjectId; documentId?: Types.ObjectId;
  action: 'submitted' | 'verified' | 'rejected' | 'more_info' | 'document_reviewed' | 'profile_changed';
  fromStatus: VerificationStatus; toStatus: VerificationStatus; reason: string; readAt?: Date | null; createdAt: Date;
}
const eventSchema = new Schema<VerificationEventRecord>({
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'VerificationDocument' },
  action: { type: String, enum: ['submitted', ...decisionActions, 'document_reviewed', 'profile_changed'], required: true },
  fromStatus: { type: String, enum: ['PENDING', 'NEEDS_INFO', 'REJECTED', 'VERIFIED'], required: true },
  toStatus: { type: String, enum: ['PENDING', 'NEEDS_INFO', 'REJECTED', 'VERIFIED'], required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ providerId: 1, createdAt: -1, _id: -1 });
eventSchema.index({ providerId: 1, action: 1, readAt: 1 });
eventSchema.index({ providerId: 1, documentId: 1, actorId: 1, action: 1 });

export const VerificationDocument = mongoose.model<VerificationDocumentRecord>('VerificationDocument', documentSchema);
export const VerificationEvent = mongoose.model<VerificationEventRecord>('VerificationEvent', eventSchema);
