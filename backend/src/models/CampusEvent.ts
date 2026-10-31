import mongoose, { Schema, Types } from 'mongoose';

export interface OrganizerIdentity { role: string; name: string; email: string; institution?: string; documentId?: Types.ObjectId; organizationName?: string; organizationType?: string }
export interface CampusOrganizerRecord { ownerId: Types.ObjectId; revision: number; status: 'approved' | 'revoked'; institution: string; identity: OrganizerIdentity; actorId: Types.ObjectId; reason: string; affiliationReference: string; createdAt: Date; updatedAt: Date }
const organizerSchema = new Schema<CampusOrganizerRecord>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, revision: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['approved', 'revoked'], required: true }, institution: { type: String, required: true, maxlength: 150 },
  identity: { type: new Schema<OrganizerIdentity>({ role: String, name: String, email: String, institution: String, documentId: Schema.Types.ObjectId, organizationName: String, organizationType: String }, { _id: false }), required: true, select: false },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, required: true, maxlength: 1000 }, affiliationReference: { type: String, required: true, maxlength: 1000, select: false },
}, { timestamps: true });
organizerSchema.index({ status: 1, updatedAt: -1, _id: -1 });
export const CampusOrganizer = mongoose.model<CampusOrganizerRecord>('CampusOrganizer', organizerSchema);

export const campusEventCategories = ['university', 'hackathon', 'workshop', 'seminar', 'career_fair', 'networking', 'other'] as const;
export const campusEventStatuses = ['draft', 'published', 'cancelled', 'completed'] as const;
export interface CampusEventRecord {
  organizerId: Types.ObjectId; organizerName: string; grantRevision: number; institution: string;
  title: string; description: string; category: typeof campusEventCategories[number]; mode: 'campus' | 'online' | 'hybrid'; venue: string; joinInstructions?: string;
  startsAt: Date; endsAt: Date; registrationClosesAt: Date; capacity: number; registeredCount: number;
  status: typeof campusEventStatuses[number]; revision: number; noticeRevision: number; createdAt: Date; updatedAt: Date;
}
const eventSchema = new Schema<CampusEventRecord>({
  organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, organizerName: { type: String, required: true, maxlength: 160 }, grantRevision: { type: Number, required: true, min: 1 }, institution: { type: String, required: true, maxlength: 150 },
  title: { type: String, required: true, minlength: 3, maxlength: 160 }, description: { type: String, required: true, minlength: 20, maxlength: 5000 }, category: { type: String, enum: campusEventCategories, required: true },
  mode: { type: String, enum: ['campus', 'online', 'hybrid'], required: true }, venue: { type: String, required: true, maxlength: 200 }, joinInstructions: { type: String, maxlength: 1500, select: false },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, registrationClosesAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 10000, validate: Number.isSafeInteger }, registeredCount: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: campusEventStatuses, required: true, default: 'draft' }, revision: { type: Number, required: true, min: 0, default: 0 }, noticeRevision: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });
eventSchema.index({ status: 1, startsAt: 1, _id: 1 });
eventSchema.index({ organizerId: 1, createdAt: -1, _id: -1 });
export const CampusEvent = mongoose.model<CampusEventRecord>('CampusEvent', eventSchema);

export interface EventRegistrationRecord { eventId: Types.ObjectId; studentId: Types.ObjectId; status: 'registered' | 'cancelled'; revision: number; attendance: 'unmarked' | 'attended' | 'absent'; registeredAt: Date; cancelledAt?: Date; attendanceRecordedAt?: Date; attendanceActorId?: Types.ObjectId; lastEventNoticeRevision: number; lastGrantNoticeRevision: number; createdAt: Date; updatedAt: Date }
const registrationSchema = new Schema<EventRegistrationRecord>({
  eventId: { type: Schema.Types.ObjectId, ref: 'CampusEvent', required: true }, studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['registered', 'cancelled'], required: true, default: 'registered' }, revision: { type: Number, required: true, min: 0, default: 0 }, attendance: { type: String, enum: ['unmarked', 'attended', 'absent'], required: true, default: 'unmarked' },
  registeredAt: { type: Date, required: true }, cancelledAt: Date, attendanceRecordedAt: Date, attendanceActorId: { type: Schema.Types.ObjectId, ref: 'User' }, lastEventNoticeRevision: { type: Number, min: 0, default: 0, required: true, select: false },
  lastGrantNoticeRevision: { type: Number, min: 0, default: 0, required: true, select: false },
}, { timestamps: true });
registrationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });
registrationSchema.index({ studentId: 1, createdAt: -1, _id: -1 });
registrationSchema.index({ eventId: 1, status: 1, registeredAt: 1, _id: 1 });
registrationSchema.index({ status: 1, _id: 1 });
export const EventRegistration = mongoose.model<EventRegistrationRecord>('EventRegistration', registrationSchema);

export interface CampusEventAuditRecord { scope: 'organizer' | 'event' | 'registration'; targetId: Types.ObjectId; eventId?: Types.ObjectId; actorId: Types.ObjectId; revision: number; action: string; reason: string; before?: Record<string, unknown>; after?: Record<string, unknown>; affiliationReference?: string; createdAt: Date }
const auditSchema = new Schema<CampusEventAuditRecord>({
  scope: { type: String, enum: ['organizer', 'event', 'registration'], required: true }, targetId: { type: Schema.Types.ObjectId, required: true }, eventId: { type: Schema.Types.ObjectId, ref: 'CampusEvent' }, actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  revision: { type: Number, required: true, min: 0 }, action: { type: String, enum: ['approved', 'revoked', 'created', 'updated', 'published', 'cancelled', 'completed', 'registered', 'registration_cancelled', 'attendance'], required: true }, reason: { type: String, required: true, maxlength: 1000 }, before: Schema.Types.Mixed, after: Schema.Types.Mixed, affiliationReference: { type: String, maxlength: 1000, select: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ scope: 1, targetId: 1, revision: 1 }, { unique: true });
auditSchema.index({ scope: 1, targetId: 1, createdAt: -1, _id: -1 });
auditSchema.index({ actorId: 1, action: 1, createdAt: 1 });
export const CampusEventAudit = mongoose.model<CampusEventAuditRecord>('CampusEventAudit', auditSchema);
