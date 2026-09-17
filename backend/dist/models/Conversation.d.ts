import mongoose, { Document } from 'mongoose';
export interface IConversation extends Document {
    participantIds: mongoose.Types.ObjectId[];
    participantKey: string;
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IConversation, {}, {}, {}, Document<unknown, {}, IConversation, {}, {}> & IConversation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
