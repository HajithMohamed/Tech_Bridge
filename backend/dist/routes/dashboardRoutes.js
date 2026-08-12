"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.protect, dashboardController_1.getImpactStats);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map