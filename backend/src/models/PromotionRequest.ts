import mongoose, { Document, Schema } from 'mongoose';

export type PromotionCompensationType = 'paid' | 'product_exchange' | 'experience' | 'affiliate';
export type PromotionRequestStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
export type CampaignStage = 'draft' | 'pending' | 'accepted' | 'in_progress' | 'submitted' | 'changes_requested' | 'reviewed' | 'completed' | 'declined' | 'cancelled';
export type CampaignAction = 'drafted' | 'terms_updated' | 'sent' | 'started' | 'created' | 'accepted' | 'declined' | 'cancelled' | 'submitted' | 'changes_requested' | 'approved' | 'completed';
export interface ICampaignTerms { campaignBrief: string; deliverables: string; compensationType: PromotionCompensationType; compensationDetails?: string; deadline?: Date }
export interface ICampaignSubmission {
  _id: mongoose.Types.ObjectId;
  text: string;
  urls: string[];
  submittedAt: Date;
  isLate?: boolean;
  review?: 'approved' | 'changes_requested';
  reviewNote?: string;
  reviewedAt?: Date;
}
export interface ICampaignHistory {
  action: CampaignAction;
  actorId: mongoose.Types.ObjectId;
  actorRole: 'student' | 'provider';
  at: Date;
  note?: string;
  terms?: ICampaignTerms;
}

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
  workflowVersion?: number;
  stage?: CampaignStage;
  publishedAt?: Date;
  agreedTerms?: ICampaignTerms;
  revision?: number;
  deliveryStatus?: 'not_submitted' | 'submitted' | 'changes_requested' | 'approved';
  submissions: ICampaignSubmission[];
  history: ICampaignHistory[];
  cancellationReason?: string;
  cancelledAt?: Date;
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
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'], default: 'pending', index: true },
    workflowVersion: { type: Number, enum: [1, 2] },
    stage: { type: String, enum: ['draft', 'pending', 'accepted', 'in_progress', 'submitted', 'changes_requested', 'reviewed', 'completed', 'declined', 'cancelled'] },
    publishedAt: Date,
    agreedTerms: { type: new Schema({ campaignBrief: { type: String, maxlength: 1000, required: true }, deliverables: { type: String, maxlength: 2000, required: true }, compensationType: { type: String, enum: ['paid', 'product_exchange', 'experience', 'affiliate'], required: true }, compensationDetails: { type: String, maxlength: 1000 }, deadline: Date }, { _id: false }) },
    revision: { type: Number, min: 0 },
    deliveryStatus: { type: String, enum: ['not_submitted', 'submitted', 'changes_requested', 'approved'] },
    submissions: [{ text: { type: String, trim: true, maxlength: 2000 }, urls: [{ type: String, maxlength: 500 }], submittedAt: { type: Date, required: true }, isLate: Boolean, review: { type: String, enum: ['approved', 'changes_requested'] }, reviewNote: { type: String, maxlength: 1000 }, reviewedAt: Date }],
    history: [{ _id: false, action: { type: String, enum: ['drafted', 'terms_updated', 'sent', 'started', 'created', 'accepted', 'declined', 'cancelled', 'submitted', 'changes_requested', 'approved', 'completed'], required: true }, actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, actorRole: { type: String, enum: ['student', 'provider'], required: true }, at: { type: Date, required: true }, note: { type: String, maxlength: 1000 }, terms: { type: new Schema({ campaignBrief: { type: String, maxlength: 1000, required: true }, deliverables: { type: String, maxlength: 2000, required: true }, compensationType: { type: String, enum: ['paid', 'product_exchange', 'experience', 'affiliate'], required: true }, compensationDetails: { type: String, maxlength: 1000 }, deadline: Date }, { _id: false }) } }],
    cancellationReason: { type: String, maxlength: 1000 },
    cancelledAt: Date,
  },
  { timestamps: true }
);

promotionRequestSchema.index({ providerId: 1, studentId: 1, status: 1 });
promotionRequestSchema.index({ providerId: 1, createdAt: -1, _id: -1 });
promotionRequestSchema.index({ studentId: 1, createdAt: -1, _id: -1 });
promotionRequestSchema.path('history').validate((rows: unknown[]) => rows.length <= 100, 'Campaign history is limited to 100 entries.');
promotionRequestSchema.path('submissions').validate((rows: unknown[]) => rows.length <= 10, 'Campaigns support up to ten submissions.');

export default mongoose.model<IPromotionRequest>('PromotionRequest', promotionRequestSchema);
