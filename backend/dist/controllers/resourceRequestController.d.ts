import { Request, Response } from 'express';
/** POST /api/resource-requests */
export declare const createResourceRequest: (req: Request, res: Response) => Promise<void>;
/** GET /api/resource-requests/mine */
export declare const listMyResourceRequests: (req: Request, res: Response) => Promise<void>;
/** GET /api/resource-requests/provider */
export declare const listProviderResourceRequests: (req: Request, res: Response) => Promise<void>;
/** GET /api/resource-requests/received — requests for a student's own shared listings */
export declare const listReceivedResourceRequests: (req: Request, res: Response) => Promise<void>;
/** PATCH /api/resource-requests/:id/status */
export declare const updateResourceRequestStatus: (req: Request, res: Response) => Promise<void>;
