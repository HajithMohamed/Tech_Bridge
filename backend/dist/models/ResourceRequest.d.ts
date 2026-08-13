import mongoose, { Document } from 'mongoose';
import { ResourceAccessType } from './Resource';
export type ResourceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export interface IResourceRequest extends Document {
    _id: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    providerId: mongoose.Types.ObjectId;
    resourceId: mongoose.Types.ObjectId;
    requestedAccessType: ResourceAccessType;
    durationOrTerms?: string;
    message?: string;
    status: ResourceRequestStatus;
    createdAt: Date;
    updatedAt: Date;
}
declare const ResourceRequest: mongoose.Model<IResourceRequest, {}, {}, {}, Document<unknown, {}, IResourceRequest, {}, {}> & IResourceRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default ResourceRequest;
