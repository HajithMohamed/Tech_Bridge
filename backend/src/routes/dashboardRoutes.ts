import { Router } from 'express';
import { getImpactStats } from '../controllers/dashboardController';
import { getRoleAnalytics } from '../controllers/analyticsController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/stats', protect, getImpactStats);
router.get('/analytics', protect, getRoleAnalytics);
router.get('/analytics/student', protect, authorize('student'), getRoleAnalytics);
router.get('/analytics/provider', protect, authorize('provider'), getRoleAnalytics);
router.get('/analytics/admin', protect, authorize('admin'), getRoleAnalytics);

export default router;
