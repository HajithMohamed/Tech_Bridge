"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
    (0, express_validator_1.body)('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('confirmPassword')
        .notEmpty()
        .withMessage('Please confirm your password')
        .custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    }),
    (0, express_validator_1.body)('role')
        .notEmpty()
        .isIn(['student', 'provider'])
        .withMessage('Role must be student or provider'),
    (0, express_validator_1.body)('studentProfile.institution')
        .if((0, express_validator_1.body)('role').equals('student'))
        .trim().notEmpty().withMessage('Institution is required'),
    (0, express_validator_1.body)('studentProfile.degree')
        .if((0, express_validator_1.body)('role').equals('student'))
        .isIn(['ICT', 'ET', 'BST', 'other']).withMessage('Select a valid degree programme'),
    (0, express_validator_1.body)('studentProfile.studyYear')
        .if((0, express_validator_1.body)('role').equals('student'))
        .isInt({ min: 1, max: 6 }).withMessage('Study year must be between 1 and 6'),
    (0, express_validator_1.body)('studentProfile.skills')
        .if((0, express_validator_1.body)('role').equals('student'))
        .isArray({ min: 1 }).withMessage('Add at least one skill or interest'),
    (0, express_validator_1.body)('providerProfile.organizationType')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .isIn(['company', 'training_org', 'scholarship_org', 'ngo', 'individual'])
        .withMessage('Select a valid organization type'),
    (0, express_validator_1.body)('providerProfile.organizationName')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .trim().isLength({ min: 2, max: 150 }).withMessage('Organization or professional name is required'),
    (0, express_validator_1.body)('providerProfile.contactPerson')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .trim().isLength({ min: 2, max: 100 }).withMessage('Contact person is required'),
    (0, express_validator_1.body)('providerProfile.contactEmail')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .trim().isEmail().withMessage('A valid provider contact email is required')
        .normalizeEmail(),
    (0, express_validator_1.body)('providerProfile.phone')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .trim().matches(/^[+0-9][0-9\\s-]{7,28}$/).withMessage('Enter a valid phone number'),
    (0, express_validator_1.body)('providerProfile.location')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .trim().notEmpty().withMessage('Location is required'),
    (0, express_validator_1.body)('providerProfile.opportunityCategories')
        .if((0, express_validator_1.body)('role').equals('provider'))
        .isArray({ min: 1 }).withMessage('Select at least one offering'),
    (0, express_validator_1.body)('providerProfile.resourceAccessMethods')
        .if((0, express_validator_1.body)('providerProfile.opportunityCategories').custom((value) => Array.isArray(value) && value.includes('technical_resources')))
        .isArray({ min: 1 }).withMessage('Select at least one resource access method'),
    validate_1.validate,
], authController_1.register);
/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
    (0, express_validator_1.body)('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    validate_1.validate,
], authController_1.login);
/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth_1.protect, authController_1.getMe);
router.patch('/providers/:id/verification', auth_1.protect, (0, auth_1.authorize)('admin'), [(0, express_validator_1.body)('verified').isBoolean().withMessage('verified must be true or false'), validate_1.validate], authController_1.updateProviderVerification);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map