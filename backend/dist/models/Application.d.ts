import mongoose, { Document } from 'mongoose';
export type ApplicationStatus = 'applied' | 'reviewed' | 'accepted' | 'rejected';
export interface IApplication extends Document {
    _id: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    providerId: mongoose.Types.ObjectId;
    opportunityId: mongoose.Types.ObjectId;
    status: ApplicationStatus;
    appliedAt: Date;
    message?: string;
    updatedAt: Date;
}
declare const Application: mongoose.Model<IApplication, {}, {}, {}, Document<unknown, {}, IApplication, {}, {}> & IApplication & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Application;
