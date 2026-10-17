import { Router } from 'express';
import { createReport } from '../controllers/reportController';
import { protect } from '../middleware/auth';

const router = Router();
router.post('/', protect, createReport);
export default router;
