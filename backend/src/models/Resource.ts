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

export interface IResourceItemDetails {
  laptop?: {
    brand: string;
    model: string;
    processor: string;
    processorGeneration: string;
    ramGb: number;
    storageGb: number;
    storageType: 'ssd' | 'hdd' | 'emmc' | 'other';
    operatingSystem?: string;
    screenSizeInches?: number;
  };
  arduino?: {
    model: string;
    microcontroller: string;
    operatingVoltage: string;
    digitalPins: number;
    analogPins: number;
    usbType?: string;
  };
  raspberryPi?: {
    model: string;
    processor: string;
    ramGb: number;
    storageSupport: string;
    wireless?: string;
  };
  sensor?: {
    sensorType: string;
    measuredParameter: string;
    operatingVoltage: string;
    interface: string;
  };
  electronicComponent?: {
    componentType: string;
    valueOrRating: string;
    packageType: string;
    voltageRating?: string;
  };
  devBoard?: {
    boardModel: string;
    microcontrollerOrProcessor: string;
    memory: string;
    connectivity: string;
  };
  other?: {
    brand?: string;
    model?: string;
    description: string;
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
  imageDataUrl?: string;
  itemDetails: IResourceItemDetails;
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
    imageDataUrl: { type: String, maxlength: 4_000_000 },
    itemDetails: {
      laptop: {
        brand: { type: String, trim: true, maxlength: 80 },
        model: { type: String, trim: true, maxlength: 100 },
        processor: { type: String, trim: true, maxlength: 120 },
        processorGeneration: { type: String, trim: true, maxlength: 80 },
        ramGb: { type: Number, min: 1, max: 512 },
        storageGb: { type: Number, min: 1, max: 20_000 },
        storageType: { type: String, enum: ['ssd', 'hdd', 'emmc', 'other'] },
        operatingSystem: { type: String, trim: true, maxlength: 100 },
        screenSizeInches: { type: Number, min: 1, max: 100 },
      },
      arduino: {
        model: { type: String, trim: true, maxlength: 100 },
        microcontroller: { type: String, trim: true, maxlength: 100 },
        operatingVoltage: { type: String, trim: true, maxlength: 50 },
        digitalPins: { type: Number, min: 0, max: 500 },
        analogPins: { type: Number, min: 0, max: 500 },
        usbType: { type: String, trim: true, maxlength: 50 },
      },
      raspberryPi: {
        model: { type: String, trim: true, maxlength: 100 },
        processor: { type: String, trim: true, maxlength: 120 },
        ramGb: { type: Number, min: 1, max: 64 },
        storageSupport: { type: String, trim: true, maxlength: 120 },
        wireless: { type: String, trim: true, maxlength: 120 },
      },
      sensor: {
        sensorType: { type: String, trim: true, maxlength: 120 },
        measuredParameter: { type: String, trim: true, maxlength: 120 },
        operatingVoltage: { type: String, trim: true, maxlength: 50 },
        interface: { type: String, trim: true, maxlength: 100 },
      },
      electronicComponent: {
        componentType: { type: String, trim: true, maxlength: 120 },
        valueOrRating: { type: String, trim: true, maxlength: 120 },
        packageType: { type: String, trim: true, maxlength: 120 },
        voltageRating: { type: String, trim: true, maxlength: 50 },
      },
      devBoard: {
        boardModel: { type: String, trim: true, maxlength: 120 },
        microcontrollerOrProcessor: { type: String, trim: true, maxlength: 120 },
        memory: { type: String, trim: true, maxlength: 100 },
        connectivity: { type: String, trim: true, maxlength: 160 },
      },
      other: {
        brand: { type: String, trim: true, maxlength: 80 },
        model: { type: String, trim: true, maxlength: 100 },
        description: { type: String, trim: true, maxlength: 1000 },
      },
    },
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
