import mongoose, { Document } from 'mongoose';
import { ResourceAccessType, ResourceCategory } from './Resource';
export type ResourceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export interface IResourceRequest extends Document {
    _id: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    providerId: mongoose.Types.ObjectId;
    resourceId: mongoose.Types.ObjectId;
    requestedAccessType: ResourceAccessType;
    resourceCategory: ResourceCategory;
    durationOrTerms?: string;
    message?: string;
    justification: string;
    selfDeclaredNeed: 'low' | 'medium' | 'high';
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
