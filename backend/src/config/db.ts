import mongoose from 'mongoose';
import { databaseErrorMessage } from '../utils/databaseError';

const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('Missing database configuration.');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    console.log('MongoDB connected.');
  } catch (error) {
    throw new Error(databaseErrorMessage(error));
  }
};

export default connectDB;
