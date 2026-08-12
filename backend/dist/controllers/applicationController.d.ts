import { Request, Response } from 'express';
/** POST /api/opportunities/:id/applications */
export declare const createApplication: (req: Request, res: Response) => Promise<void>;
/** GET /api/opportunities/:id/applications */
export declare const listOpportunityApplications: (req: Request, res: Response) => Promise<void>;
/** GET /api/applications/provider */
export declare const listProviderApplications: (req: Request, res: Response) => Promise<void>;
/** GET /api/applications/mine */
export declare const listMyApplications: (req: Request, res: Response) => Promise<void>;
/** PATCH /api/applications/:id/status */
export declare const updateApplicationStatus: (req: Request, res: Response) => Promise<void>;
