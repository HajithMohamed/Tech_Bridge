import { Request, Response } from 'express';
/** POST /api/opportunities */
export declare const createOpportunity: (req: Request, res: Response) => Promise<void>;
/** GET /api/opportunities */
export declare const listOpportunities: (req: Request, res: Response) => Promise<void>;
/** GET /api/opportunities/scholarships */
export declare const listScholarships: (_req: Request, res: Response) => Promise<void>;
/** GET /api/opportunities/mine */
export declare const listMyOpportunities: (req: Request, res: Response) => Promise<void>;
/** GET /api/opportunities/:id */
export declare const getOpportunity: (req: Request, res: Response) => Promise<void>;
/** PUT /api/opportunities/:id */
export declare const updateOpportunity: (req: Request, res: Response) => Promise<void>;
/** DELETE /api/opportunities/:id */
export declare const deleteOpportunity: (req: Request, res: Response) => Promise<void>;
