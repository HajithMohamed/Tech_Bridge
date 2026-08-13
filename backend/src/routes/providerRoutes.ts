import { Router } from 'express';
import { getProviderDashboard, updateProviderProfile } from '../controllers/providerController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.get('/dashboard', protect, authorize('provider'), getProviderDashboard);
router.put('/profile', protect, authorize('provider'), updateProviderProfile);

export default router;
