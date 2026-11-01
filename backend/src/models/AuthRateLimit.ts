import mongoose, { Schema } from 'mongoose';

// Keys hash the scope, identity and fixed time window. Neither email addresses
// nor network addresses need to be retained in this short-lived collection.
const authRateLimitSchema = new Schema({
  _id: { type: String, required: true },
  attempts: { type: Number, required: true, min: 1 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('AuthRateLimit', authRateLimitSchema);
