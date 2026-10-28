import { Router } from 'express';
import {
  createApplication,
  listMyApplications,
  listProviderApplications,
  listOpportunityApplications,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { authorize, protect } from '../middleware/auth';
import { addScholarshipEvidence, createScholarshipAppeal, decideScholarshipAppeal, downloadScholarshipEvidence, getScholarshipAssessment, listScholarshipAppeals, listScholarshipEvidence, refreshScholarshipPriority, scholarshipHistory } from '../controllers/scholarshipController';

const router = Router();

router.post('/', protect, authorize('student'), createApplication);
router.get('/mine', protect, authorize('student'), listMyApplications);
router.get('/provider', protect, authorize('provider'), listProviderApplications);
router.get('/opportunity/:id', protect, authorize('provider'), listOpportunityApplications);
router.patch('/:id/status', protect, authorize('provider'), updateApplicationStatus);
router.get('/:id/scholarship', protect, authorize('student', 'provider'), getScholarshipAssessment);
router.get('/:id/scholarship/history', protect, authorize('student', 'provider'), scholarshipHistory());
router.get('/:id/scholarship/evidence', protect, authorize('student', 'provider'), listScholarshipEvidence);
router.post('/:id/scholarship/evidence', protect, authorize('student'), addScholarshipEvidence);
router.get('/:id/scholarship/evidence/:documentId', protect, authorize('student'), downloadScholarshipEvidence());
router.post('/:id/scholarship/evidence/:documentId/access', protect, authorize('provider'), downloadScholarshipEvidence(true));
router.post('/:id/scholarship/appeals', protect, authorize('student'), createScholarshipAppeal);
router.get('/:id/scholarship/appeals', protect, authorize('student', 'provider'), listScholarshipAppeals);
router.post('/:id/scholarship/appeals/:appealId/review', protect, authorize('provider'), decideScholarshipAppeal);
router.post('/:id/scholarship/recalculate', protect, authorize('provider'), refreshScholarshipPriority);

export default router;
