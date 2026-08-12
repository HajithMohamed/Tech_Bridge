import { Router } from 'express';
import { getImpactStats } from '../controllers/dashboardController';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/stats', protect, getImpactStats);

export default router;
