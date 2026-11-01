import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db';
import { notificationWorkerConfiguration } from './services/notificationPolicy';
import { notificationTick, startNotificationWorker } from './services/notificationWorker';

dotenv.config();
async function start() {
  const configuration = notificationWorkerConfiguration();
  await connectDB();
  if (process.argv.includes('--once')) { try { console.log(await notificationTick(configuration.batchSize)); } finally { await mongoose.disconnect(); } return; }
  const stop = startNotificationWorker(configuration);
  let stopping = false;
  const close = async () => { if (stopping) return; stopping = true; await stop(); await mongoose.disconnect(); };
  process.once('SIGTERM', () => void close()); process.once('SIGINT', () => void close());
  if (!configuration.enabled) await close();
}
void start().catch(async () => { console.error('Notification worker could not start.'); await mongoose.disconnect(); process.exitCode = 1; });
