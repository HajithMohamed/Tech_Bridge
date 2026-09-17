import mongoose, { Document } from 'mongoose';
export type OrganizationType = 'company' | 'training_org' | 'scholarship_org' | 'resource_provider' | 'local_business' | 'alumni' | 'faculty' | 'ngo' | 'individual';
export type CreatorPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'other';
export type CreatorCompensationPreference = 'paid' | 'product_exchange' | 'experience' | 'affiliate';
export interface ICreatorPlatformProfile {
    platform: CreatorPlatform;
    handle: string;
    profileUrl: string;
    followerCount?: number;
}
export interface ICreatorProfile {
    isDiscoverable: boolean;
    platforms: ICreatorPlatformProfile[];
    niches: string[];
    contentTypes: string[];
    compensationPreference: CreatorCompensationPreference[];
    sampleWorkLinks?: string[];
}
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    fullName: string;
    email: string;
    password: string;
    role: 'student' | 'provider' | 'admin';
    accountStatus: 'active' | 'suspended';
    studentProfile?: {
        institution: string;
        degree: 'ICT' | 'ET' | 'BST' | 'other';
        studyYear: number;
        location?: string;
        skills: string[];
        careerGoal?: string;
        availabilityHours?: number;
        preferredWorkType?: 'remote' | 'on-site' | 'hybrid' | 'flexible';
        creatorProfile?: ICreatorProfile;
    };
    providerProfile?: {
        organizationName: string;
        organizationType: OrganizationType;
        verified: boolean;
        verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
        rejectionReason?: string;
        contactEmail: string;
        contactPerson: string;
        phone: string;
        location: string;
        website?: string;
        logoUrl?: string;
        description?: string;
        verificationDocumentName?: string;
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
