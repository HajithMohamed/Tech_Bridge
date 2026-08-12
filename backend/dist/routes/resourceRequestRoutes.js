"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const resourceRequestController_1 = require("../controllers/resourceRequestController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.protect, (0, auth_1.authorize)('student'), resourceRequestController_1.createResourceRequest);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('student'), resourceRequestController_1.listMyResourceRequests);
router.get('/provider', auth_1.protect, (0, auth_1.authorize)('provider'), resourceRequestController_1.listProviderResourceRequests);
router.patch('/:id/status', auth_1.protect, (0, auth_1.authorize)('provider'), resourceRequestController_1.updateResourceRequestStatus);
exports.default = router;
//# sourceMappingURL=resourceRequestRoutes.js.map