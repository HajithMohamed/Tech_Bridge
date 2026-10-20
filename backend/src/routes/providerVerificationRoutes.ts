import { Router } from 'express';
import { protectVerification } from '../middleware/auth';
import { verificationSessionLimit } from '../middleware/verificationRateLimit';
import { downloadOwnVerificationDocument, getVerificationStatus, markVerificationNoticeRead, uploadVerificationDocument, verificationHistory, verificationSession } from '../controllers/providerVerificationController';

export function providerVerificationRoutes() {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/session', verificationSessionLimit(), verificationSession);
  router.use(protectVerification);
  router.get('/', getVerificationStatus);
  router.post('/documents', uploadVerificationDocument);
  router.get('/documents/:documentId', downloadOwnVerificationDocument);
  router.get('/history', verificationHistory(false));
  router.patch('/history/:eventId/read', markVerificationNoticeRead);
  return router;
}
