import { Router } from 'express';
import { getCreator, listCreators, updateCreatorProfile, verifiedCreatorProviderOnly } from '../controllers/creatorController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.put('/profile', protect, authorize('student'), updateCreatorProfile);
router.get('/', protect, authorize('provider'), verifiedCreatorProviderOnly, listCreators);
router.get('/:studentId', protect, authorize('provider'), verifiedCreatorProviderOnly, getCreator);

export default router;
