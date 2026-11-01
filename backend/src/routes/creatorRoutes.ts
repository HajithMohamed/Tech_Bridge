import { Router } from 'express';
import { getCreator, listCreators, updateCreatorProfile, updateCreatorVisibility, verifiedCreatorProviderOnly } from '../controllers/creatorController';
import { authorize, protect } from '../middleware/auth';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.put('/profile', protect, authorize('student'), updateCreatorProfile);
router.patch('/profile/visibility', protect, authorize('student'), updateCreatorVisibility);
router.get('/', protect, authorize('provider'), verifiedCreatorProviderOnly, listCreators);
router.get('/:studentId', protect, authorize('provider'), verifiedCreatorProviderOnly, getCreator);

export default router;
