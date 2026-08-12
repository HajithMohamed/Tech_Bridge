"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.protect, (0, auth_1.authorize)('student'), applicationController_1.createApplication);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('student'), applicationController_1.listMyApplications);
router.get('/provider', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.listProviderApplications);
router.get('/opportunity/:id', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.listOpportunityApplications);
router.patch('/:id/status', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.updateApplicationStatus);
exports.default = router;
//# sourceMappingURL=applicationRoutes.js.map