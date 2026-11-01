import mongoose, { Schema, Types } from 'mongoose';

export interface TimeWindow { startAt: Date; endAt: Date }
export interface MentorProfileRecord {
  ownerId: Types.ObjectId; revision: number; enabled: boolean; expertise: string[];
  bio: string; timeZone: string; windows: TimeWindow[]; identityKey?: string;
}
const windowSchema = new Schema<TimeWindow>({ startAt: { type: Date, required: true }, endAt: { type: Date, required: true } }, { _id: false });
const profileSchema = new Schema<MentorProfileRecord>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  revision: { type: Number, required: true, min: 1 }, enabled: { type: Boolean, required: true, default: false },
  expertise: [{ type: String, maxlength: 80 }], bio: { type: String, required: true, maxlength: 1000 },
  timeZone: { type: String, required: true, maxlength: 80 }, windows: { type: [windowSchema], default: [] },
  identityKey: { type: String, maxlength: 200, select: false },
}, { timestamps: true });
profileSchema.index({ enabled: 1, ownerId: 1 });
export const MentorProfile = mongoose.model<MentorProfileRecord>('MentorProfile', profileSchema);

export interface MentorApprovalRecord {
  ownerId: Types.ObjectId; revision: number; status: 'approved' | 'revoked';
  documentId: Types.ObjectId; actorId: Types.ObjectId; reason: string;
}
const approvalSchema = new Schema<MentorApprovalRecord>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  revision: { type: Number, required: true, min: 1 }, status: { type: String, enum: ['approved', 'revoked'], required: true },
  documentId: { type: Schema.Types.ObjectId, required: true }, actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, maxlength: 1000 },
}, { timestamps: true });
export const MentorApproval = mongoose.model<MentorApprovalRecord>('MentorApproval', approvalSchema);

export const mentorshipStatuses = ['pending', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled'] as const;
export type MentorshipStatus = typeof mentorshipStatuses[number];
export interface ScheduleProposal extends TimeWindow { proposedBy: Types.ObjectId }
export interface MentorshipRecord {
  mentorId: Types.ObjectId; studentId: Types.ObjectId; revision: number; status: MentorshipStatus;
  topic: string; message: string; appointment?: TimeWindow; proposal?: ScheduleProposal;
  createdAt: Date; updatedAt: Date;
}
const proposalSchema = new Schema<ScheduleProposal>({ startAt: { type: Date, required: true }, endAt: { type: Date, required: true }, proposedBy: { type: Schema.Types.ObjectId, required: true } }, { _id: false });
const sessionSchema = new Schema<MentorshipRecord>({
  mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  revision: { type: Number, required: true, min: 1, default: 1 }, status: { type: String, enum: mentorshipStatuses, required: true, default: 'pending' },
  topic: { type: String, required: true, maxlength: 120 }, message: { type: String, required: true, maxlength: 1000 },
  appointment: windowSchema, proposal: proposalSchema,
}, { timestamps: true });
sessionSchema.index({ mentorId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'approved', 'scheduled'] } } });
sessionSchema.index({ mentorId: 1, status: 1, 'appointment.startAt': 1, 'appointment.endAt': 1 });
sessionSchema.index({ studentId: 1, status: 1, 'appointment.startAt': 1, 'appointment.endAt': 1 });
sessionSchema.index({ studentId: 1, createdAt: -1, _id: -1 });
sessionSchema.index({ mentorId: 1, createdAt: -1, _id: -1 });
sessionSchema.index({ status: 1, _id: 1 });
sessionSchema.index({ createdAt: 1 });
export const Mentorship = mongoose.model<MentorshipRecord>('Mentorship', sessionSchema);

export interface MentorshipEventRecord {
  sessionId: Types.ObjectId; actorId: Types.ObjectId; revision: number; action: string;
  fromStatus: MentorshipStatus | 'none'; toStatus: MentorshipStatus; reason?: string;
  appointment?: TimeWindow; proposal?: ScheduleProposal; createdAt: Date;
}
const eventSchema = new Schema<MentorshipEventRecord>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true }, actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  revision: { type: Number, required: true, min: 1 }, action: { type: String, enum: ['requested', 'approve', 'reject', 'cancel', 'complete', 'propose', 'accept', 'decline'], required: true },
  fromStatus: { type: String, enum: ['none', ...mentorshipStatuses], required: true }, toStatus: { type: String, enum: mentorshipStatuses, required: true },
  reason: { type: String, maxlength: 1000 }, appointment: windowSchema, proposal: proposalSchema,
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ sessionId: 1, revision: 1 }, { unique: true });
eventSchema.index({ sessionId: 1, createdAt: -1, _id: -1 });
eventSchema.index({ actorId: 1, action: 1, createdAt: 1 });
export const MentorshipEvent = mongoose.model<MentorshipEventRecord>('MentorshipEvent', eventSchema);
