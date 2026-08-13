import { Request, Response, NextFunction } from 'express';
/**
 * Validation middleware runner — collects express-validator errors and
 * returns 400 with error details if validation fails
 */
export declare const validate: (req: Request, res: Response, next: NextFunction) => void;
