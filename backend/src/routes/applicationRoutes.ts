import { Router } from 'express';
import {
  createApplication,
  listMyApplications,
  listProviderApplications,
  listOpportunityApplications,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, authorize('student'), createApplication);
router.get('/mine', protect, authorize('student'), listMyApplications);
router.get('/provider', protect, authorize('provider'), listProviderApplications);
router.get('/opportunity/:id', protect, authorize('provider'), listOpportunityApplications);
router.patch('/:id/status', protect, authorize('provider'), updateApplicationStatus);

export default router;
