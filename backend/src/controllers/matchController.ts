import type { Request, Response } from 'express';
import { matchedOpportunities } from '../services/opportunityDiscovery';
import { ScholarshipError } from '../services/scholarshipPolicy';

/** Keep the original score/skill fields while bounding globally ranked responses. */
export const getMatchedOpportunities = async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await matchedOpportunities(req.user!._id, req.query) }); }
  catch (error) { res.status(error instanceof ScholarshipError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipError ? error.message : 'Unable to calculate opportunity matches.' }); }
};
