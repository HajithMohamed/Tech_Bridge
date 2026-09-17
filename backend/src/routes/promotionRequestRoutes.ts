import { Router } from 'express';
import { createPromotionRequest, listMyPromotionRequests, listProviderPromotionRequests, updatePromotionRequestStatus, verifiedCreatorProviderOnly } from '../controllers/creatorController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, authorize('provider'), verifiedCreatorProviderOnly, createPromotionRequest);
router.get('/mine', protect, authorize('student'), listMyPromotionRequests);
router.get('/provider', protect, authorize('provider'), verifiedCreatorProviderOnly, listProviderPromotionRequests);
router.patch('/:id/status', protect, updatePromotionRequestStatus);

export default router;
