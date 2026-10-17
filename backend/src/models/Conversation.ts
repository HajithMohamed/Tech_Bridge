import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participantIds: mongoose.Types.ObjectId[];
  participantKey: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  participantIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    validate: { validator: (ids: mongoose.Types.ObjectId[]) => ids.length === 2 && !ids[0].equals(ids[1]), message: 'A conversation must have exactly two different participants.' },
  },
  participantKey: { type: String, required: true, unique: true },
  lastMessageAt: { type: Date, index: true },
}, { timestamps: true });

conversationSchema.index({ participantIds: 1 });
export default mongoose.model<IConversation>('Conversation', conversationSchema);
