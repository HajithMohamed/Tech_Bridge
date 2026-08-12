"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/provider', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.listProviderApplications);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('student'), applicationController_1.listMyApplications);
router.patch('/:id/status', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.updateApplicationStatus);
router.post('/opportunities/:id', auth_1.protect, (0, auth_1.authorize)('student'), applicationController_1.createApplication);
router.get('/opportunities/:id', auth_1.protect, (0, auth_1.authorize)('provider'), applicationController_1.listOpportunityApplications);
exports.default = router;
//# sourceMappingURL=applicationRoutes.js.map