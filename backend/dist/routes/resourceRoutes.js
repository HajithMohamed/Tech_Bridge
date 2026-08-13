"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const resourceController_1 = require("../controllers/resourceController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', resourceController_1.listResources);
router.get('/mine', auth_1.protect, resourceController_1.listMyResources);
router.post('/', auth_1.protect, resourceController_1.createResource);
router.patch('/:id/status', auth_1.protect, resourceController_1.updateResourceStatus);
router.patch('/:id/inventory', auth_1.protect, resourceController_1.updateResourceInventory);
router.delete('/:id', auth_1.protect, resourceController_1.deleteResource);
router.get('/:id', resourceController_1.getResource);
exports.default = router;
//# sourceMappingURL=resourceRoutes.js.map