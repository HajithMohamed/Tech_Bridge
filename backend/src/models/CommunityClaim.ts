import mongoose, { Schema, Types } from 'mongoose';

export const claimStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO', 'REVOKED'] as const;
export type ClaimStatus = typeof claimStatuses[number];
export interface CommunityProfile {
  visibility: 'members' | 'hidden'; acceptsStudentMessages: boolean;
  expertise: string[]; availability: string; bio: string;
}
export interface CommunityClaimRecord {
  providerId: Types.ObjectId; directoryId: string; documentId: Types.ObjectId;
  institution: string; justification: string; status: ClaimStatus; revision: number;
  decisionReason?: string; profile: CommunityProfile; createdAt: Date; updatedAt: Date;
}
const profileSchema = new Schema<CommunityProfile>({
  visibility: { type: String, enum: ['members', 'hidden'], default: 'hidden' },
  acceptsStudentMessages: { type: Boolean, default: false },
  expertise: [{ type: String, maxlength: 80 }], availability: { type: String, maxlength: 200, default: '' },
  bio: { type: String, maxlength: 1000, default: '' },
}, { _id: false });
const claimSchema = new Schema<CommunityClaimRecord>({
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  directoryId: { type: String, required: true, maxlength: 100 },
  documentId: { type: Schema.Types.ObjectId, ref: 'VerificationDocument', required: true },
  institution: { type: String, required: true, maxlength: 150 },
  justification: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: claimStatuses, default: 'PENDING', required: true },
  revision: { type: Number, min: 1, default: 1, required: true },
  decisionReason: { type: String, maxlength: 1000 },
  profile: { type: profileSchema, default: () => ({}) },
}, { timestamps: true });
claimSchema.index({ directoryId: 1 }, { unique: true, partialFilterExpression: { status: 'APPROVED' } });
claimSchema.index({ status: 1, createdAt: 1, _id: 1 });

export interface CommunityClaimEventRecord {
  claimId: Types.ObjectId; providerId: Types.ObjectId; actorId: Types.ObjectId;
  directoryId: string; documentId: Types.ObjectId; revision: number;
  action: 'submitted' | 'approved' | 'rejected' | 'more_info' | 'revoked' | 'profile_updated' | 'identity_changed' | 'verification_changed';
  fromStatus: ClaimStatus | 'NONE'; toStatus: ClaimStatus; reason: string;
  affiliationMethod?: string; affiliationReference?: string; createdAt: Date;
}
const eventSchema = new Schema<CommunityClaimEventRecord>({
  claimId: { type: Schema.Types.ObjectId, ref: 'CommunityClaim', required: true },
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  directoryId: { type: String, required: true }, documentId: { type: Schema.Types.ObjectId, required: true },
  revision: { type: Number, required: true },
  action: { type: String, enum: ['submitted', 'approved', 'rejected', 'more_info', 'revoked', 'profile_updated', 'identity_changed', 'verification_changed'], required: true },
  fromStatus: { type: String, enum: ['NONE', ...claimStatuses], required: true },
  toStatus: { type: String, enum: claimStatuses, required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  affiliationMethod: { type: String, enum: ['institution_confirmation', 'official_directory', 'alumni_records'] },
  affiliationReference: { type: String, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ providerId: 1, createdAt: -1, _id: -1 });
eventSchema.index({ claimId: 1, createdAt: -1, _id: -1 });

export const CommunityClaim = mongoose.model<CommunityClaimRecord>('CommunityClaim', claimSchema);
export const CommunityClaimEvent = mongoose.model<CommunityClaimEventRecord>('CommunityClaimEvent', eventSchema);
