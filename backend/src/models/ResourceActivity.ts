import mongoose, { Schema } from 'mongoose';

const eventSchema = new Schema({
  resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ResourceRequest' },
  disputeId: { type: Schema.Types.ObjectId, ref: 'ResourceDispute' },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, reason: { type: String, maxlength: 1000 },
  fromStatus: String, toStatus: String, revision: Number,
  quantityBefore: Number, quantityAfter: Number, priorityOverrideReason: { type: String, maxlength: 1000 },
  legacyReservationConfirmed: Boolean,
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ requestId: 1, createdAt: -1, _id: -1 });
eventSchema.index({ resourceId: 1, createdAt: -1, _id: -1 });
export const ResourceEvent = mongoose.model('ResourceEvent', eventSchema);

const disputeSchema = new Schema({
  resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'ResourceRequest', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  statement: { type: String, required: true, minlength: 30, maxlength: 2000 },
  status: { type: String, enum: ['open', 'resolved', 'withdrawn'], default: 'open', required: true },
  resolution: { type: String, maxlength: 1000 }, resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }, resolvedAt: Date,
}, { timestamps: true });
disputeSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });
disputeSchema.index({ requestId: 1, createdAt: -1 });
disputeSchema.index({ status: 1, createdAt: 1 });
export const ResourceDispute = mongoose.model('ResourceDispute', disputeSchema);
