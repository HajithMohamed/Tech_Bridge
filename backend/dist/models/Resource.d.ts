import mongoose, { Document } from 'mongoose';
export type ResourceCategory = 'laptop' | 'arduino' | 'raspberry_pi' | 'sensor' | 'electronic_component' | 'dev_board' | 'other';
export type ResourceCondition = 'new' | 'used_good' | 'used_fair';
export type ResourceAccessType = 'borrow' | 'share' | 'rent' | 'installment' | 'interest_free' | 'sponsorship' | 'donation';
export type ResourceStatus = 'available' | 'claimed';
export interface IResourceAccessDetails {
    borrowShare?: {
        borrowDurationDays: number;
        pickupLocation: string;
        returnCondition: string;
    };
    rent?: {
        pricePerMonth: number;
        currency: string;
        minRentalMonths: number;
        securityDeposit?: number;
    };
    installment?: {
        totalPrice: number;
        downPayment: number;
        monthlyInstallmentAmount: number;
        numberOfMonths: number;
        lateFeePolicy: string;
    };
    interestFree?: {
        totalPrice: number;
        monthlyInstallmentAmount: number;
        numberOfMonths: number;
        eligibilityCriteria: string[];
        repaymentStartDate: Date;
        interestRate: 0;
    };
    sponsorship?: {
        eligibilityCriteria: string[];
        applicationDeadline: Date;
        numberOfUnitsAvailable: number;
        sponsorOrganization: string;
    };
    donation?: {
        itemAgeYears: number;
        conditionNotes: string;
        pickupOrDeliveryMethod: string;
        claimDeadline: Date;
    };
}
export interface IResourceListing extends Document {
    _id: mongoose.Types.ObjectId;
    itemName: string;
    category: ResourceCategory;
    condition?: ResourceCondition;
    accessType: ResourceAccessType;
    listedBy: mongoose.Types.ObjectId;
    providerOrgVerified: boolean;
    quantityAvailable: number;
    status: ResourceStatus;
    accessDetails: IResourceAccessDetails;
    createdAt: Date;
    updatedAt: Date;
}
declare const Resource: mongoose.Model<IResourceListing, {}, {}, {}, Document<unknown, {}, IResourceListing, {}, {}> & IResourceListing & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Resource;
