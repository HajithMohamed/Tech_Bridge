"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const creatorController_1 = require("../controllers/creatorController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.put('/profile', auth_1.protect, (0, auth_1.authorize)('student'), creatorController_1.updateCreatorProfile);
router.get('/', auth_1.protect, (0, auth_1.authorize)('provider'), creatorController_1.verifiedCreatorProviderOnly, creatorController_1.listCreators);
router.get('/:studentId', auth_1.protect, (0, auth_1.authorize)('provider'), creatorController_1.verifiedCreatorProviderOnly, creatorController_1.getCreator);
exports.default = router;
//# sourceMappingURL=creatorRoutes.js.map