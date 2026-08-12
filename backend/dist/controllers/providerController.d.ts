import { Request, Response } from 'express';
/** GET /api/provider/dashboard */
export declare const getProviderDashboard: (req: Request, res: Response) => Promise<void>;
/** PUT /api/provider/profile */
export declare const updateProviderProfile: (req: Request, res: Response) => Promise<void>;
/** GET /api/providers/:id */
export declare const getPublicProviderProfile: (req: Request, res: Response) => Promise<void>;
