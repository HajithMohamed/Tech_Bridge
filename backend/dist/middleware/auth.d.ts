import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/User';
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
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Authorize by role — checks if the user's role is in the allowed list
 */
export declare const authorize: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
