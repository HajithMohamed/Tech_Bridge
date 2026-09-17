import { Request, Response } from 'express';
export declare const startConversation: (req: Request, res: Response) => Promise<void>;
export declare const listConversations: (req: Request, res: Response) => Promise<void>;
export declare const listConversationMessages: (req: Request, res: Response) => Promise<void>;
export declare const sendMessage: (req: Request, res: Response) => Promise<void>;
export declare const markConversationRead: (req: Request, res: Response) => Promise<void>;
export declare const listMentors: (_req: Request, res: Response) => Promise<void>;
