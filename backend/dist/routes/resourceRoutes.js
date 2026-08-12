"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const resourceController_1 = require("../controllers/resourceController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', resourceController_1.listResources);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('provider'), resourceController_1.listMyResources);
router.post('/', auth_1.protect, (0, auth_1.authorize)('provider'), resourceController_1.createResource);
router.get('/:id', resourceController_1.getResource);
router.put('/:id', auth_1.protect, (0, auth_1.authorize)('provider'), resourceController_1.updateResource);
router.delete('/:id', auth_1.protect, (0, auth_1.authorize)('provider'), resourceController_1.deleteResource);
exports.default = router;
//# sourceMappingURL=resourceRoutes.js.map