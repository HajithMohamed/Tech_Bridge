import { Router } from 'express';
import {
  createResourceRequest,
  listMyResourceRequests,
  listProviderResourceRequests,
  listReceivedResourceRequests,
  updateResourceRequestStatus,
} from '../controllers/resourceRequestController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, authorize('student'), createResourceRequest);
router.get('/mine', protect, authorize('student'), listMyResourceRequests);
router.get('/provider', protect, authorize('provider'), listProviderResourceRequests);
router.get('/received', protect, authorize('student'), listReceivedResourceRequests);
router.patch('/:id/status', protect, updateResourceRequestStatus);

export default router;
