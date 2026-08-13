import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, updateStudentProfile } from '../controllers/authController';
import { authorize, protect } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    body('role')
      .notEmpty()
      .isIn(['student', 'provider'])
      .withMessage('Role must be student or provider'),
    body('studentProfile.institution')
      .if(body('role').equals('student'))
      .trim().notEmpty().withMessage('Institution is required'),
    body('studentProfile.degree')
      .if(body('role').equals('student'))
      .isIn(['ICT', 'ET', 'BST', 'other']).withMessage('Select a valid degree programme'),
    body('studentProfile.studyYear')
      .if(body('role').equals('student'))
      .isInt({ min: 1, max: 6 }).withMessage('Study year must be between 1 and 6'),
    body('studentProfile.skills')
      .if(body('role').equals('student'))
      .isArray({ min: 1 }).withMessage('Add at least one skill or interest'),
    body('providerProfile.organizationType')
      .if(body('role').equals('provider'))
      .isIn(['company', 'training_org', 'scholarship_org', 'resource_provider', 'local_business', 'alumni', 'faculty', 'ngo', 'individual'])
      .withMessage('Select a valid organization type'),
    body('providerProfile.organizationName')
      .if(body('role').equals('provider'))
      .trim().isLength({ min: 2, max: 150 }).withMessage('Organization or professional name is required'),
    body('providerProfile.contactPerson')
      .if(body('role').equals('provider'))
      .trim().isLength({ min: 2, max: 100 }).withMessage('Contact person is required'),
    body('providerProfile.contactEmail')
      .if(body('role').equals('provider'))
      .trim().isEmail().withMessage('A valid provider contact email is required')
      .normalizeEmail(),
    body('providerProfile.phone')
      .if(body('role').equals('provider'))
      .trim().matches(/^[+0-9][0-9\\s-]{7,28}$/).withMessage('Enter a valid phone number'),
    body('providerProfile.location')
      .if(body('role').equals('provider'))
      .trim().notEmpty().withMessage('Location is required'),
    body('providerProfile.description')
      .if(body('role').equals('provider'))
      .trim().isLength({ min: 20, max: 1000 }).withMessage('Organization description must be between 20 and 1000 characters'),
    body('providerProfile.verificationDocumentName')
      .optional()
      .trim().isLength({ max: 255 }).withMessage('Verification document filename cannot exceed 255 characters'),
    body('providerProfile.opportunityCategories')
      .if(body('role').equals('provider'))
      .isArray({ min: 1 }).withMessage('Select at least one offering'),
    body('providerProfile.resourceAccessMethods')
      .if(body('providerProfile.opportunityCategories').custom((value) => Array.isArray(value) && value.includes('technical_resources')))
      .isArray({ min: 1 }).withMessage('Select at least one resource access method'),
    validate,
  ],
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', protect, getMe);
router.put('/student-profile', protect, authorize('student'), updateStudentProfile);

export default router;
