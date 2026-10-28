import { Router } from 'express';
import {
  createResource,
  deleteResource,
  getResource,
  listMyResources,
  listResources,
  updateResourceInventory,
  updateResourceStatus,
} from '../controllers/resourceController';
import { protect } from '../middleware/auth';
import { advanceResourceWaitlist, resourceListingHistory, resourceWaitlist } from '../controllers/resourceLifecycleController';

const router = Router();

router.get('/', listResources);
router.get('/mine', protect, listMyResources);
router.post('/', protect, createResource);
router.patch('/:id/status', protect, updateResourceStatus);
router.patch('/:id/inventory', protect, updateResourceInventory);
router.delete('/:id', protect, deleteResource);
router.get('/:id/waitlist', protect, resourceWaitlist);
router.post('/:id/waitlist/advance', protect, advanceResourceWaitlist);
router.get('/:id/history', protect, resourceListingHistory);
router.get('/:id', getResource);

export default router;
