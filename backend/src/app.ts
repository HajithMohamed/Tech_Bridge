import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import opportunityRoutes from './routes/opportunityRoutes';
import resourceRoutes from './routes/resourceRoutes';
import applicationRoutes from './routes/applicationRoutes';
import providerRoutes from './routes/providerRoutes';
import publicProviderRoutes from './routes/publicProviderRoutes';
import resourceRequestRoutes from './routes/resourceRequestRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import adminRoutes from './routes/adminRoutes';
import reportRoutes from './routes/reportRoutes';
import messageRoutes from './routes/messageRoutes';
import creatorRoutes from './routes/creatorRoutes';
import promotionRequestRoutes from './routes/promotionRequestRoutes';
import { providerVerificationRoutes } from './routes/providerVerificationRoutes';
import { adminCommunityRoutes, communityRoutes } from './routes/communityRoutes';


/** Build the API without connecting to MongoDB or opening a listener. */
export const createApp = () => {
  const app = express();
  // Middleware
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/provider-verification', providerVerificationRoutes());
  app.use('/api/community', communityRoutes());
  app.use('/api/admin/community-claims', adminCommunityRoutes());
  app.use('/api/opportunities', opportunityRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/provider', providerRoutes);
  app.use('/api/providers', publicProviderRoutes);
  app.use('/api/resource-requests', resourceRequestRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/creators', creatorRoutes);
  app.use('/api/promotion-requests', promotionRequestRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      message: 'TechBridge API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });


  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    const code = status === 413 ? 413 : status === 400 ? 400 : 500;
    res.status(code).json({ success: false, message: code === 413 ? 'Request body is too large.' : code === 400 ? 'Invalid request body.' : 'Unable to process the request.' });
  });
  return app;
};
