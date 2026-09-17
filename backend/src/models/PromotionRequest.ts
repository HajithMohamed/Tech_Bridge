import mongoose, { Document, Schema } from 'mongoose';

export type PromotionCompensationType = 'paid' | 'product_exchange' | 'experience' | 'affiliate';
export type PromotionRequestStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface IPromotionRequest extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  campaignBrief: string;
  deliverables: string;
  compensationType: PromotionCompensationType;
  compensationDetails?: string;
  deadline?: Date;
  status: PromotionRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const promotionRequestSchema = new Schema<IPromotionRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaignBrief: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    deliverables: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    compensationType: { type: String, required: true, enum: ['paid', 'product_exchange', 'experience', 'affiliate'] },
    compensationDetails: { type: String, trim: true, maxlength: 1000 },
    deadline: { type: Date },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed'], default: 'pending', index: true },
  },
  { timestamps: true }
);

promotionRequestSchema.index({ providerId: 1, studentId: 1, status: 1 });

export default mongoose.model<IPromotionRequest>('PromotionRequest', promotionRequestSchema);
