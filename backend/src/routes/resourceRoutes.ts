import { Router } from 'express';
import {
  createResource,
  deleteResource,
  getResource,
  listMyResources,
  listResources,
  updateResource,
} from '../controllers/resourceController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

router.get('/', listResources);
router.get('/mine', protect, authorize('provider'), listMyResources);
router.post('/', protect, authorize('provider'), createResource);
router.get('/:id', getResource);
router.put('/:id', protect, authorize('provider'), updateResource);
router.delete('/:id', protect, authorize('provider'), deleteResource);

export default router;
