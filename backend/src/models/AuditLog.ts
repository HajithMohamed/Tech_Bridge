import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  action: string;
  targetType: 'user' | 'opportunity' | 'resource';
  targetId: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, trim: true, maxlength: 100 },
  targetType: { type: String, required: true, enum: ['user', 'opportunity', 'resource'], index: true },
  targetId: { type: Schema.Types.ObjectId, required: true, index: true },
  reason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
export default mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
