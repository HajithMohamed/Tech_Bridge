import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IReport, {}, {}, {}, Document<unknown, {}, IReport, {}, {}> & IReport & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
