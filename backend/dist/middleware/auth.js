"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.protect = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = __importDefault(require("../models/User"));
/**
 * Protect routes — verifies JWT Bearer token and attaches user to request
 */
const protect = async (req, res, next) => {
    try {
        let token;
        // Extract token from Authorization header
        if (req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized — no token provided',
            });
            return;
        }
        // Verify token
        const decoded = (0, jwt_1.verifyToken)(token);
        // Find user and attach to request
        const user = await User_1.default.findById(decoded.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Not authorized — user not found',
            });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Not authorized — invalid token',
        });
    }
};
exports.protect = protect;
/**
 * Authorize by role — checks if the user's role is in the allowed list
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: `Role '${req.user?.role}' is not authorized to access this resource`,
            });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.js.map