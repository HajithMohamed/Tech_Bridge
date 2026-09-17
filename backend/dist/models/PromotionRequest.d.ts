import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IPromotionRequest, {}, {}, {}, Document<unknown, {}, IPromotionRequest, {}, {}> & IPromotionRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
