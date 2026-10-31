import mongoose, { Schema } from 'mongoose';
import { notificationActions, notificationHrefs, notificationKinds } from '../services/notificationPolicy';

// Reuse historical pending campaign notices; delivery is now leased and durable.
const schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: notificationKinds, required: true },
  action: { type: String, enum: notificationActions, default: 'updated' },
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 500 },
  href: { type: String, required: true, enum: notificationHrefs },
  dedupeKey: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ['pending', 'processing', 'delivered', 'suppressed', 'failed'], default: 'pending' },
  sourceType: { type: String, enum: ['campaign', 'message', 'application', 'scholarship', 'resource', 'verification', 'community', 'mentorship', 'opportunity'] },
  sourceId: Schema.Types.ObjectId,
  scheduledFor: Date,
  attempts: { type: Number, default: 0, min: 0 }, nextAttemptAt: Date,
  leaseToken: { type: String, select: false }, leaseUntil: Date, deliveredAt: Date, processedAt: Date,
  outcome: { type: String, enum: ['delivered', 'preferences', 'recipient', 'message_unavailable', 'stale_source', 'invalid_notice', 'delivery_failed', 'lease_exhausted'] },
}, { timestamps: true });
schema.index({ ownerId: 1, dedupeKey: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
schema.index({ status: 1, leaseUntil: 1 });
export default mongoose.model('NotificationOutbox', schema);
