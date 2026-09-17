import mongoose, { Document } from 'mongoose';
export interface IAuditLog extends Document {
    adminId: mongoose.Types.ObjectId;
    action: string;
    targetType: 'user' | 'opportunity' | 'resource';
    targetId: mongoose.Types.ObjectId;
    reason?: string;
    createdAt: Date;
}
declare const _default: mongoose.Model<IAuditLog, {}, {}, {}, Document<unknown, {}, IAuditLog, {}, {}> & IAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
