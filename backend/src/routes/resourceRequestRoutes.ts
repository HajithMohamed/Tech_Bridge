import { Router } from 'express';
import {
  createResourceRequest,
  listMyResourceRequests,
  listProviderResourceRequests,
  listReceivedResourceRequests,
  updateResourceRequestStatus,
} from '../controllers/resourceRequestController';
import { authorize, protect } from '../middleware/auth';
import { cancelPendingResource, confirmReturnedResource, createResourceDispute, decideResourceDispute, getResourceHistory, getResourceRequest, listResourceDisputes, submitResourceReturn } from '../controllers/resourceLifecycleController';

const router = Router();

router.post('/', protect, authorize('student'), createResourceRequest);
router.get('/mine', protect, authorize('student'), listMyResourceRequests);
router.get('/provider', protect, authorize('provider'), listProviderResourceRequests);
router.get('/received', protect, authorize('student'), listReceivedResourceRequests);
router.patch('/:id/status', protect, updateResourceRequestStatus);
router.get('/:id', protect, getResourceRequest);
router.get('/:id/history', protect, getResourceHistory);
router.post('/:id/cancel', protect, authorize('student'), cancelPendingResource);
router.post('/:id/return', protect, authorize('student'), submitResourceReturn);
router.post('/:id/return/confirm', protect, confirmReturnedResource);
router.get('/:id/disputes', protect, listResourceDisputes);
router.post('/:id/disputes', protect, createResourceDispute);
router.post('/:id/disputes/:disputeId/resolve', protect, decideResourceDispute);

export default router;
