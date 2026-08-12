import mongoose, { Document } from 'mongoose';
export type OpportunityType = 'job' | 'internship' | 'scholarship' | 'course' | 'freelance' | 'workshop';
export interface IOpportunity extends Document {
    _id: mongoose.Types.ObjectId;
    title: string;
    description: string;
    type: OpportunityType;
    requiredSkills: string[];
    location: string;
    workMode: 'remote' | 'on-site' | 'hybrid';
    providerId: mongoose.Types.ObjectId;
    status: 'draft' | 'open' | 'closed' | 'expired';
    views: number;
    applicationDeadline: Date;
    amount?: number;
    currency?: string;
    coverageType?: 'full' | 'partial' | 'tuition_only' | 'equipment_only' | 'stipend';
    eligibilityCriteria?: string[];
    numberOfAwards?: number;
    renewable?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const Opportunity: mongoose.Model<IOpportunity, {}, {}, {}, Document<unknown, {}, IOpportunity, {}, {}> & IOpportunity & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Opportunity;
