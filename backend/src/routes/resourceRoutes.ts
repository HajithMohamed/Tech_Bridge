import { Router } from 'express';
import {
  createResource,
  deleteResource,
  getResource,
  listMyResources,
  listResources,
  updateResourceStatus,
} from '../controllers/resourceController';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', listResources);
router.get('/mine', protect, listMyResources);
router.post('/', protect, createResource);
router.patch('/:id/status', protect, updateResourceStatus);
router.delete('/:id', protect, deleteResource);
router.get('/:id', getResource);

export default router;
