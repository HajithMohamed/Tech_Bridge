import dotenv from 'dotenv';
import connectDB from './config/db';
import { createApp } from './app';

dotenv.config();
const app = createApp();
const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 TechBridge API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('API startup failed:', error instanceof Error ? error.message : 'Database startup failed.');
    process.exit(1);
  }
};

startServer();
