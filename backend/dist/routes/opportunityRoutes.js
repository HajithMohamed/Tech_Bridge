"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const opportunityController_1 = require("../controllers/opportunityController");
const matchController_1 = require("../controllers/matchController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const verifiedProviderOnly = (req, res, next) => {
    if (!req.user?.providerProfile?.verified) {
        res.status(403).json({ success: false, message: 'Your provider account must be verified before publishing opportunities.' });
        return;
    }
    next();
};
router.get('/', opportunityController_1.listOpportunities);
router.get('/scholarships', opportunityController_1.listScholarships);
router.get('/mine', auth_1.protect, (0, auth_1.authorize)('provider'), verifiedProviderOnly, opportunityController_1.listMyOpportunities);
router.get('/matched', auth_1.protect, (0, auth_1.authorize)('student'), matchController_1.getMatchedOpportunities);
router.post('/', auth_1.protect, (0, auth_1.authorize)('provider'), verifiedProviderOnly, opportunityController_1.createOpportunity);
router.get('/:id', opportunityController_1.getOpportunity);
router.put('/:id', auth_1.protect, (0, auth_1.authorize)('provider'), verifiedProviderOnly, opportunityController_1.updateOpportunity);
router.delete('/:id', auth_1.protect, (0, auth_1.authorize)('provider'), verifiedProviderOnly, opportunityController_1.deleteOpportunity);
exports.default = router;
//# sourceMappingURL=opportunityRoutes.js.map