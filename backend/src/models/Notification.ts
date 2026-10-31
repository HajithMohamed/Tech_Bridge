import mongoose, { Schema } from 'mongoose';
import { notificationActions, notificationHrefs, notificationKinds } from '../services/notificationPolicy';

const schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: notificationKinds, required: true },
  action: { type: String, enum: notificationActions, default: 'updated', required: true },
  title: { type: String, required: true, maxlength: 100 }, body: { type: String, required: true, maxlength: 500 },
  href: { type: String, enum: notificationHrefs, required: true }, dedupeKey: { type: String, required: true, maxlength: 200, select: false },
  sourceType: { type: String, enum: ['campaign', 'message', 'application', 'scholarship', 'resource', 'verification', 'community', 'mentorship', 'opportunity'] },
  sourceId: { type: Schema.Types.ObjectId }, occurredAt: { type: Date, required: true }, readAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ ownerId: 1, dedupeKey: 1 }, { unique: true });
schema.index({ ownerId: 1, occurredAt: -1, _id: -1 });
schema.index({ ownerId: 1, readAt: 1, kind: 1 });
export default mongoose.model('Notification', schema);

const preferenceSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  revision: { type: Number, min: 0, default: 0, required: true }, inApp: { type: Boolean, default: true, required: true },
  categories: Object.fromEntries(notificationKinds.map(kind => [kind, { type: Boolean, default: true, required: true }])),
}, { timestamps: true });
export const NotificationPreferences = mongoose.model('NotificationPreferences', preferenceSchema);

const producerSchema = new Schema({ key: { type: String, enum: ['scholarship-reminders', 'resource-reminders', 'mentorship-reminders', 'saved-opportunity-reminders'], required: true, unique: true }, afterId: Schema.Types.ObjectId, revision: { type: Number, default: 0 } }, { timestamps: true });
export const NotificationProducer = mongoose.model('NotificationProducer', producerSchema);
