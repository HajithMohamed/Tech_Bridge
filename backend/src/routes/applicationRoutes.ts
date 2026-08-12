import { Router } from 'express';
import { listMyApplications, listProviderApplications, updateApplicationStatus } from '../controllers/applicationController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.get('/provider', protect, authorize('provider'), listProviderApplications);
router.get('/mine', protect, authorize('student'), listMyApplications);
router.patch('/:id/status', protect, authorize('provider'), updateApplicationStatus);
export default router;
