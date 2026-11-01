import mongoose, { Schema, Types } from 'mongoose';

// Exact complaint access records are private to the administrative workflow.
const schema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
  messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, minlength: 10, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ reportId: 1, createdAt: -1, _id: -1 });
export default mongoose.model<{ reportId: Types.ObjectId; messageId: Types.ObjectId; actorId: Types.ObjectId; reason: string; createdAt: Date }>('MessageReviewAccess', schema);
