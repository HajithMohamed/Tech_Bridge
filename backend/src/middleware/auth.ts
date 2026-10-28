import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { bearerToken } from '../utils/bearer';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Protect routes — verifies JWT Bearer token and attaches user to request
 */
const authenticate = (verificationOnly: boolean) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Include authorization failures and every protected endpoint, including dashboards.
  res.set('Cache-Control', 'no-store');
  try {
    const token = bearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized — no token provided',
      });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (decoded.scope !== undefined && (!verificationOnly || decoded.scope !== 'verification')) {
      res.status(401).json({ success: false, message: 'This session is restricted to provider verification.' });
      return;
    }

    // Find user and attach to request
    const user = await User.findById(decoded.userId).select('+tokenVersion');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized — user not found',
      });
      return;
    }

    if ((decoded.version ?? 0) !== (user.tokenVersion ?? 0)) {
      res.status(401).json({ success: false, message: 'Your session changed. Please sign in again.' });
      return;
    }
    user.set('tokenVersion', undefined);

    if (user.accountStatus === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'This account has been suspended. Contact TechBridge support if you believe this is a mistake.',
      });
      return;
    }

    if (verificationOnly && user.role !== 'provider') {
      res.status(403).json({ success: false, message: 'A provider account is required.' });
      return;
    }
    if (!verificationOnly && user.role === 'provider' && (user.providerProfile?.verified !== true || user.providerProfile.verificationStatus !== 'VERIFIED')) {
      res.status(403).json({ success: false, message: 'Complete provider verification before accessing the platform.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized — invalid token',
    });
  }
};

export const protect = authenticate(false);
export const protectVerification = authenticate(true);

/**
 * Authorize by role — checks if the user's role is in the allowed list
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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
