import mongoose, { Document, Schema } from 'mongoose';

export type ReportTargetType = 'opportunity' | 'resource' | 'user' | 'message' | 'promotion_request';

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed';
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>({
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, required: true, enum: ['opportunity', 'resource', 'user', 'message', 'promotion_request'], index: true },
  targetId: { type: Schema.Types.ObjectId, required: true, index: true },
  reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open', index: true },
  resolutionNote: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
export default mongoose.model<IReport>('Report', reportSchema);
