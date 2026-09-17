"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messageController_1 = require("../controllers/messageController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/directory', messageController_1.listMentors);
router.post('/conversations', messageController_1.startConversation);
router.get('/conversations', messageController_1.listConversations);
router.get('/conversations/:id/messages', messageController_1.listConversationMessages);
router.post('/conversations/:id/messages', messageController_1.sendMessage);
router.patch('/conversations/:id/read', messageController_1.markConversationRead);
exports.default = router;
//# sourceMappingURL=messageRoutes.js.map