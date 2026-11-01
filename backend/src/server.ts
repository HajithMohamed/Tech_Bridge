import dotenv from 'dotenv';
import connectDB from './config/db';
import { createApp } from './app';
import mongoose from 'mongoose';
import { notificationWorkerConfiguration } from './services/notificationPolicy';
import { startNotificationWorker } from './services/notificationWorker';

dotenv.config();
const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    const app = createApp();
    const notificationConfiguration = notificationWorkerConfiguration();
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`🚀 TechBridge API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });
    const stopNotifications = startNotificationWorker(notificationConfiguration);
    let stopping = false;
    const stop = async () => {
      if (stopping) return; stopping = true;
      await stopNotifications();
      await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
      await mongoose.disconnect();
    };
    process.once('SIGTERM', () => void stop()); process.once('SIGINT', () => void stop());
  } catch (error) {
    console.error('API startup failed:', error instanceof Error ? error.message : 'Database startup failed.');
    process.exit(1);
  }
};

startServer();
