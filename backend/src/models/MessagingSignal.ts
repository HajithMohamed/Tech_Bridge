import mongoose, { Schema } from 'mongoose';

// Ephemeral refresh/typing hints only. Message bodies and bearer tokens never
// enter the shared live-update channel. Durable history remains in Message.
const schema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true },
  workerId: { type: String, required: true },
  type: { type: String, required: true, enum: ['refresh', 'typing'] },
  conversationId: { type: Schema.Types.ObjectId },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('MessagingSignal', schema);
