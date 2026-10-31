import mongoose, { Schema, Types } from 'mongoose';

export interface IMessagingSettings {
  ownerId: Types.ObjectId;
  acceptsMessages: boolean;
  notifications: boolean;
  blockedIds: Types.ObjectId[];
}
const schema = new Schema<IMessagingSettings>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  acceptsMessages: { type: Boolean, default: true },
  notifications: { type: Boolean, default: true },
  blockedIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [], validate: (ids: Types.ObjectId[]) => ids.length <= 200 },
}, { timestamps: true });
export default mongoose.model<IMessagingSettings>('MessagingSettings', schema);
