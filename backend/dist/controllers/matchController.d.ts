import { Request, Response } from 'express';
/**
 * GET /api/opportunities/matched
 *
 * For the currently logged-in student, return all open opportunities
 * sorted by match score descending. Each opportunity includes:
 *   matchPercentage, matchedSkills, missingSkills, skillResources
 */
export declare const getMatchedOpportunities: (req: Request, res: Response) => Promise<void>;
