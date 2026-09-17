import { NextFunction, Request, Response } from 'express';
declare const verifyProvider: (req: Request, res: Response, next: NextFunction) => void;
/** PUT /api/creators/profile */
export declare const updateCreatorProfile: (req: Request, res: Response) => Promise<void>;
/** GET /api/creators */
export declare const listCreators: (req: Request, res: Response) => Promise<void>;
/** GET /api/creators/:studentId */
export declare const getCreator: (req: Request, res: Response) => Promise<void>;
/** POST /api/promotion-requests */
export declare const createPromotionRequest: (req: Request, res: Response) => Promise<void>;
/** GET /api/promotion-requests/mine */
export declare const listMyPromotionRequests: (req: Request, res: Response) => Promise<void>;
/** GET /api/promotion-requests/provider */
export declare const listProviderPromotionRequests: (req: Request, res: Response) => Promise<void>;
/** PATCH /api/promotion-requests/:id/status */
export declare const updatePromotionRequestStatus: (req: Request, res: Response) => Promise<void>;
export declare const verifiedCreatorProviderOnly: typeof verifyProvider;
export {};
