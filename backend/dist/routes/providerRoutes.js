"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const providerController_1 = require("../controllers/providerController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/dashboard', auth_1.protect, (0, auth_1.authorize)('provider'), providerController_1.getProviderDashboard);
router.put('/profile', auth_1.protect, (0, auth_1.authorize)('provider'), providerController_1.updateProviderProfile);
exports.default = router;
//# sourceMappingURL=providerRoutes.js.map