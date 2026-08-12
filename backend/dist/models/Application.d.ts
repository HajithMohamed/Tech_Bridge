import mongoose, { Document } from 'mongoose';
export type ApplicationStatus = 'submitted' | 'reviewing' | 'accepted' | 'rejected';
export interface IApplication extends Document {
    _id: mongoose.Types.ObjectId;
    opportunityId: mongoose.Types.ObjectId;
    applicantId: mongoose.Types.ObjectId;
    message?: string;
    status: ApplicationStatus;
    createdAt: Date;
    updatedAt: Date;
}
declare const Application: mongoose.Model<IApplication, {}, {}, {}, Document<unknown, {}, IApplication, {}, {}> & IApplication & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Application;
