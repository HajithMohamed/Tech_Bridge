import mongoose, { Schema } from 'mongoose';

// Pending campaign notices only. Delivery/UI belongs to the notification phase.
const schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['campaign'], required: true },
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 500 },
  href: { type: String, required: true, enum: ['/my-promotion-requests', '/provider/promotion-requests'] },
  dedupeKey: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ['pending'], default: 'pending' },
}, { timestamps: true });
schema.index({ ownerId: 1, dedupeKey: 1 }, { unique: true });
export default mongoose.model('NotificationOutbox', schema);
