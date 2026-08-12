import { Router } from 'express';
import {
  createResourceRequest,
  listMyResourceRequests,
  listProviderResourceRequests,
  updateResourceRequestStatus,
} from '../controllers/resourceRequestController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, authorize('student'), createResourceRequest);
router.get('/mine', protect, authorize('student'), listMyResourceRequests);
router.get('/provider', protect, authorize('provider'), listProviderResourceRequests);
router.patch('/:id/status', protect, authorize('provider'), updateResourceRequestStatus);

export default router;
