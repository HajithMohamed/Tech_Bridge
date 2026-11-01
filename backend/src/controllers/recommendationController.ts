import type { Request, Response } from 'express';
import { getRecommendationProfile, personalizedOpportunities, updateRecommendationProfile } from '../services/personalizedOpportunities';
import { opportunityObject } from '../services/opportunityPolicy';
import { ScholarshipError } from '../services/scholarshipPolicy';
import { AuthThrottleError, consumeAuthLimit } from '../services/authThrottle';

const failure = (res: Response, error: unknown) => {
  if (error instanceof AuthThrottleError) return res.set('Retry-After', String(error.retryAfter)).status(429).json({ success: false, message: error.message });
  return res.status(error instanceof ScholarshipError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipError ? error.message : 'Recommendations are temporarily unavailable.' });
};
export const getRecommendations = async (req: Request, res: Response) => {
  try {
    await consumeAuthLimit('recommendations:student', String(req.user!._id), 60, 60_000);
    res.json({ success: true, data: await personalizedOpportunities(req.user!._id, req.sessionVersion ?? 0, req.query) });
  } catch (error) { failure(res, error); }
};
export const getRecommendationPreferences = async (req: Request, res: Response) => {
  try { opportunityObject(req.query, []); res.json({ success: true, data: await getRecommendationProfile(req.user!._id, req.sessionVersion ?? 0) }); } catch (error) { failure(res, error); }
};
export const patchRecommendationPreferences = async (req: Request, res: Response) => {
  try { opportunityObject(req.query, []); res.json({ success: true, data: await updateRecommendationProfile(req.user!._id, req.sessionVersion ?? 0, req.body) }); } catch (error) { failure(res, error); }
};
