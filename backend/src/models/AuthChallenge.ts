import mongoose, { Schema } from 'mongoose';

const authChallengeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  purpose: { type: String, enum: ['verify_email', 'password_reset'], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });
authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
export default mongoose.model('AuthChallenge', authChallengeSchema);
