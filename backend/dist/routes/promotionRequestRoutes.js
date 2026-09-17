"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const creatorController_1 = require("../controllers/creatorController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.protect, (0, auth_1.authorize)('provider'), creatorController_1.verifiedCreatorProviderOnly, creatorController_1.createPromotionRequest);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('student'), creatorController_1.listMyPromotionRequests);
router.get('/provider', auth_1.protect, (0, auth_1.authorize)('provider'), creatorController_1.verifiedCreatorProviderOnly, creatorController_1.listProviderPromotionRequests);
router.patch('/:id/status', auth_1.protect, creatorController_1.updatePromotionRequestStatus);
exports.default = router;
//# sourceMappingURL=promotionRequestRoutes.js.map