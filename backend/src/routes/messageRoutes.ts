import { Router } from 'express';
import { listConversationMessages, listConversations, listMentors, markConversationRead, sendMessage, startConversation } from '../controllers/messageController';
import { protect } from '../middleware/auth';

const router = Router();
router.use(protect);
router.get('/directory', listMentors);
router.post('/conversations', startConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', listConversationMessages);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markConversationRead);
export default router;
