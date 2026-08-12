import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import {
  createOpportunity,
  deleteOpportunity,
  getOpportunity,
  listMyOpportunities,
  listOpportunities,
  listScholarships,
  updateOpportunity,
} from '../controllers/opportunityController';
import { getMatchedOpportunities } from '../controllers/matchController';
import { authorize, protect } from '../middleware/auth';

const router = Router();

const verifiedProviderOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.providerProfile?.verified) {
    res.status(403).json({ success: false, message: 'Your provider account must be verified before publishing opportunities.' });
    return;
  }
  next();
};

router.get('/', listOpportunities);
router.get('/scholarships', listScholarships);
router.get('/mine', protect, authorize('provider'), verifiedProviderOnly, listMyOpportunities);
router.get('/matched', protect, authorize('student'), getMatchedOpportunities);
router.post('/', protect, authorize('provider'), verifiedProviderOnly, createOpportunity);
router.get('/:id', getOpportunity);
router.put('/:id', protect, authorize('provider'), verifiedProviderOnly, updateOpportunity);
router.delete('/:id', protect, authorize('provider'), verifiedProviderOnly, deleteOpportunity);

export default router;
