import mongoose, { Document } from 'mongoose';
export type OrganizationType = 'company' | 'training_org' | 'scholarship_org' | 'ngo' | 'individual';
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    fullName: string;
    email: string;
    password: string;
    role: 'student' | 'provider' | 'admin';
    studentProfile?: {
        institution: string;
        degree: 'ICT' | 'ET' | 'BST' | 'other';
        studyYear: number;
        location?: string;
        skills: string[];
        careerGoal?: string;
    };
    providerProfile?: {
        organizationName: string;
        organizationType: OrganizationType;
        verified: boolean;
        contactEmail: string;
        contactPerson: string;
        phone: string;
        location: string;
        website?: string;
        logoUrl?: string;
        description?: string;
        opportunityCategories: string[];
        resourceAccessMethods?: string[];
    };
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default User;
