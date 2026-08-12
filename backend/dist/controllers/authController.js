"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.updateProviderVerification = exports.login = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
const jwt_1 = require("../utils/jwt");
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
const register = async (req, res) => {
    try {
        const { fullName, email, password, role, studentProfile, providerProfile } = req.body;
        // Check if user already exists
        const existingUser = await User_1.default.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'A user with this email already exists',
            });
            return;
        }
        // Only allow student and provider roles through registration
        const allowedRoles = ['student', 'provider'];
        const userRole = allowedRoles.includes(role) ? role : 'student';
        // Create new user
        const user = await User_1.default.create({
            fullName,
            email,
            password,
            role: userRole,
            ...(userRole === 'student'
                ? { studentProfile }
                : {
                    providerProfile: {
                        ...providerProfile,
                        verified: false,
                    },
                }),
        });
        // Providers must be reviewed before they can access the provider portal.
        const isPendingProvider = user.role === 'provider' && !user.providerProfile?.verified;
        const token = isPendingProvider ? undefined : (0, jwt_1.generateToken)(user._id.toString(), user.role);
        res.status(201).json({
            success: true,
            message: isPendingProvider
                ? 'Provider application received. Your account will be activated after verification.'
                : 'Registration successful',
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    studentProfile: user.studentProfile,
                    providerProfile: user.providerProfile,
                    createdAt: user.createdAt,
                },
                ...(token ? { token } : {}),
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
        });
    }
};
exports.register = register;
/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user and explicitly include password field
        const user = await User_1.default.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }
        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }
        if (user.role === 'provider' && !user.providerProfile?.verified) {
            res.status(403).json({
                success: false,
                message: 'This provider account is awaiting verification.',
            });
            return;
        }
        // Generate token
        const token = (0, jwt_1.generateToken)(user._id.toString(), user.role);
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    studentProfile: user.studentProfile,
                    providerProfile: user.providerProfile,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
        });
    }
};
exports.login = login;
/**
 * @route   PATCH /api/auth/providers/:id/verification
 * @desc    Approve or revoke a provider account. Only administrators may do this.
 * @access  Private/Admin
 */
const updateProviderVerification = async (req, res) => {
    try {
        const provider = await User_1.default.findOne({ _id: req.params.id, role: 'provider' });
        if (!provider || !provider.providerProfile) {
            res.status(404).json({ success: false, message: 'Provider not found' });
            return;
        }
        provider.providerProfile.verified = req.body.verified;
        await provider.save();
        res.status(200).json({
            success: true,
            message: req.body.verified ? 'Provider verified' : 'Provider verification revoked',
            data: {
                provider: {
                    _id: provider._id,
                    fullName: provider.fullName,
                    email: provider.email,
                    providerProfile: provider.providerProfile,
                },
            },
        });
    }
    catch (error) {
        console.error('Provider verification error:', error);
        res.status(500).json({ success: false, message: 'Server error updating provider verification' });
    }
};
exports.updateProviderVerification = updateProviderVerification;
/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user?._id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    studentProfile: user.studentProfile,
                    providerProfile: user.providerProfile,
                    createdAt: user.createdAt,
                },
            },
        });
    }
    catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};
exports.getMe = getMe;
//# sourceMappingURL=authController.js.map