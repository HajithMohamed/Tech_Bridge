import mongoose, { Document, Schema } from 'mongoose';

export type ResourceCategory =
  | 'laptop'
  | 'arduino'
  | 'raspberry_pi'
  | 'sensor'
  | 'development_board'
  | 'electronic_component'
  | 'project_equipment'
  | 'other';
export type AccessMethod =
  | 'borrow'
  | 'share'
  | 'rent'
  | 'installment'
  | 'interest_free'
  | 'sponsorship'
  | 'donation';

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

const resourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    category: {
      type: String,
      required: true,
      enum: ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'development_board', 'electronic_component', 'project_equipment', 'other'],
    },
    accessMethods: {
      type: [{ type: String, enum: ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'] }],
      validate: { validator: (value: unknown[]) => Array.isArray(value) && value.length > 0, message: 'Select at least one access method' },
      required: true,
    },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    availability: { type: String, enum: ['available', 'unavailable'], default: 'available', index: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    rentalRate: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'LKR', maxlength: 6 },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    views: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

resourceSchema.index({ availability: 1, category: 1, accessMethods: 1 });

const Resource = mongoose.model<IResource>('Resource', resourceSchema);

export default Resource;
