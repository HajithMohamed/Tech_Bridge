import { Request, Response } from 'express';
/** POST /api/resources */
export declare const createResource: (req: Request, res: Response) => Promise<void>;
/** GET /api/resources */
export declare const listResources: (req: Request, res: Response) => Promise<void>;
/** GET /api/resources/mine */
export declare const listMyResources: (req: Request, res: Response) => Promise<void>;
/** GET /api/resources/:id */
export declare const getResource: (req: Request, res: Response) => Promise<void>;
/** PUT /api/resources/:id */
export declare const updateResource: (req: Request, res: Response) => Promise<void>;
/** DELETE /api/resources/:id */
export declare const deleteResource: (req: Request, res: Response) => Promise<void>;
