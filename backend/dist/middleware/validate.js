"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const express_validator_1 = require("express-validator");
/**
 * Validation middleware runner — collects express-validator errors and
 * returns 400 with error details if validation fails
 */
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const extractedErrors = errors.array().map((err) => ({
            field: err.path || 'unknown',
            message: err.msg,
        }));
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: extractedErrors,
        });
        return;
    }
    next();
};
exports.validate = validate;
//# sourceMappingURL=validate.js.map