import { Router } from 'express';
import {
  createApplication,
  listMyApplications,
  listOpportunityApplications,
  listProviderApplications,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.get('/provider', protect, authorize('provider'), listProviderApplications);
router.get('/mine', protect, authorize('student'), listMyApplications);
router.patch('/:id/status', protect, authorize('provider'), updateApplicationStatus);
router.post('/opportunities/:id', protect, authorize('student'), createApplication);
router.get('/opportunities/:id', protect, authorize('provider'), listOpportunityApplications);

export default router;
