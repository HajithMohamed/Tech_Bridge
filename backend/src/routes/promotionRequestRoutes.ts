import { Router } from 'express';
import { createPromotionRequest, listMyPromotionRequests, listProviderPromotionRequests, updatePromotionRequestStatus, submitPromotionDeliverables, reviewPromotionDeliverables, verifiedCreatorProviderOnly } from '../controllers/creatorController';
import { authorize, protect } from '../middleware/auth';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/', protect, authorize('provider'), verifiedCreatorProviderOnly, createPromotionRequest);
router.get('/mine', protect, authorize('student'), listMyPromotionRequests);
router.get('/provider', protect, authorize('provider'), verifiedCreatorProviderOnly, listProviderPromotionRequests);
router.patch('/:id/status', protect, updatePromotionRequestStatus);
router.post('/:id/submissions', protect, authorize('student'), submitPromotionDeliverables);
router.post('/:id/review', protect, authorize('provider'), verifiedCreatorProviderOnly, reviewPromotionDeliverables);

export default router;
