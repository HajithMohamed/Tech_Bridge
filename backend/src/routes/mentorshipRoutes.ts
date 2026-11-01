import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { actOnMentorship, approveIndustryMentor, browseMentors, createMentorship, getMentorAvailability, getMentorProfile, getMentorship, getMentorships, industryMentorHistory, industryMentors, mentorshipHistory, saveMentorProfile } from '../controllers/mentorshipController';

const router = Router();
router.use(protect);
router.use((req, res, next) => {
  if (req.user?.requiresEmailVerification && !req.user.emailVerifiedAt) { res.status(403).json({ success: false, message: 'Verify your email before accessing mentorship.' }); return; }
  next();
});
router.get('/admin/mentors', authorize('admin'), industryMentors);
router.get('/admin/mentors/:id/history', authorize('admin'), industryMentorHistory);
router.put('/admin/mentors/:id/approval', authorize('admin'), approveIndustryMentor);
router.get('/profile', authorize('provider'), getMentorProfile);
router.put('/profile', authorize('provider'), saveMentorProfile);
router.get('/mentors', authorize('student'), browseMentors);
router.get('/mentors/:id/availability', authorize('student'), getMentorAvailability);
router.post('/sessions', authorize('student'), createMentorship);
router.get('/sessions', authorize('student', 'provider'), getMentorships);
router.get('/sessions/:id', authorize('student', 'provider'), getMentorship);
router.get('/sessions/:id/history', authorize('student', 'provider'), mentorshipHistory);
for (const action of ['approve', 'reject', 'cancel', 'complete']) router.post(`/sessions/:id/${action}`, authorize('student', 'provider'), actOnMentorship(action));
router.post('/sessions/:id/schedule', authorize('student', 'provider'), actOnMentorship('propose'));
router.post('/sessions/:id/schedule/accept', authorize('student', 'provider'), actOnMentorship('accept'));
router.post('/sessions/:id/schedule/decline', authorize('student', 'provider'), actOnMentorship('decline'));
export default router;
