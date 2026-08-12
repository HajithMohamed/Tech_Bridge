import mongoose, { Document } from 'mongoose';
export type ResourceCategory = 'laptop' | 'arduino' | 'raspberry_pi' | 'sensor' | 'development_board' | 'electronic_component' | 'project_equipment' | 'other';
export type AccessMethod = 'borrow' | 'share' | 'rent' | 'installment' | 'interest_free' | 'sponsorship' | 'donation';
export interface IResource extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    description: string;
    category: ResourceCategory;
    accessMethods: AccessMethod[];
    location: string;
    availability: 'available' | 'unavailable';
    quantity: number;
    rentalRate?: number;
    currency?: string;
    providerId: mongoose.Types.ObjectId;
    views: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const Resource: mongoose.Model<IResource, {}, {}, {}, Document<unknown, {}, IResource, {}, {}> & IResource & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Resource;
