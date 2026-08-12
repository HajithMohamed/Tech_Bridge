import mongoose, { Document, Schema } from 'mongoose';

export type ResourceCategory =
  | 'laptop'
  | 'arduino'
  | 'raspberry_pi'
  | 'sensor'
  | 'electronic_component'
  | 'dev_board'
  | 'other';

export type ResourceCondition = 'new' | 'used_good' | 'used_fair';
export type ResourceAccessType =
  | 'borrow'
  | 'share'
  | 'rent'
  | 'installment'
  | 'interest_free'
  | 'sponsorship'
  | 'donation';
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

const resourceSchema = new Schema<IResourceListing>(
  {
    itemName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160, index: true },
    category: {
      type: String,
      required: true,
      enum: ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'],
      index: true,
    },
    condition: { type: String, enum: ['new', 'used_good', 'used_fair'] },
    accessType: {
      type: String,
      required: true,
      enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'],
      index: true,
    },
    listedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerOrgVerified: { type: Boolean, required: true, default: false, index: true },
    quantityAvailable: { type: Number, required: true, min: 0, default: 1 },
    status: { type: String, enum: ['available', 'claimed'], default: 'available', index: true },
    accessDetails: {
      borrowShare: {
        borrowDurationDays: { type: Number, min: 1 },
        pickupLocation: { type: String, trim: true, maxlength: 200 },
        returnCondition: { type: String, trim: true, maxlength: 1000 },
      },
      rent: {
        pricePerMonth: { type: Number, min: 0 },
        currency: { type: String, trim: true, uppercase: true, maxlength: 6 },
        minRentalMonths: { type: Number, min: 1 },
        securityDeposit: { type: Number, min: 0 },
      },
      installment: {
        totalPrice: { type: Number, min: 0 },
        downPayment: { type: Number, min: 0 },
        monthlyInstallmentAmount: { type: Number, min: 0 },
        numberOfMonths: { type: Number, min: 1 },
        lateFeePolicy: { type: String, trim: true, maxlength: 500 },
      },
      interestFree: {
        totalPrice: { type: Number, min: 0 },
        monthlyInstallmentAmount: { type: Number, min: 0 },
        numberOfMonths: { type: Number, min: 1 },
        eligibilityCriteria: [{ type: String, trim: true, maxlength: 300 }],
        repaymentStartDate: { type: Date },
        interestRate: { type: Number, required: true, default: 0, min: 0, max: 0 },
      },
      sponsorship: {
        eligibilityCriteria: [{ type: String, trim: true, maxlength: 300 }],
        applicationDeadline: { type: Date },
        numberOfUnitsAvailable: { type: Number, min: 1 },
        sponsorOrganization: { type: String, trim: true, maxlength: 160 },
      },
      donation: {
        itemAgeYears: { type: Number, min: 0, max: 100 },
        conditionNotes: { type: String, trim: true, maxlength: 1000 },
        pickupOrDeliveryMethod: { type: String, trim: true, maxlength: 100 },
        claimDeadline: { type: Date },
      },
    },
  },
  { timestamps: true }
);

resourceSchema.index({ status: 1, accessType: 1, category: 1, createdAt: -1 });

const Resource = mongoose.model<IResourceListing>('Resource', resourceSchema);

export default Resource;
