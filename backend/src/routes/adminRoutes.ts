import { Router } from 'express';
import { listAuditLog, listProvidersForVerification, listReports, listUsers, rejectProvider, reinstateUser, removeOpportunity, removeResource, resolveReport, suspendUser, verifyProvider } from '../controllers/adminController';
import { authorize, protect } from '../middleware/auth';

const router = Router();
router.use(protect, authorize('admin'));
router.get('/providers', listProvidersForVerification);
router.patch('/providers/:id/verify', verifyProvider);
router.patch('/providers/:id/reject', rejectProvider);
router.get('/users', listUsers);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/reinstate', reinstateUser);
router.get('/reports', listReports);
router.patch('/reports/:id', resolveReport);
router.delete('/opportunities/:id', removeOpportunity);
router.delete('/resources/:id', removeResource);
router.get('/audit-log', listAuditLog);
export default router;
