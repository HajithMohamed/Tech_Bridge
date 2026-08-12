import { Request, Response } from 'express';
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export declare const register: (req: Request, res: Response) => Promise<void>;
/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
export declare const login: (req: Request, res: Response) => Promise<void>;
/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
export declare const getMe: (req: Request, res: Response) => Promise<void>;
