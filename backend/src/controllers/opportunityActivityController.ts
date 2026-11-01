import type { Request, Response } from 'express';
import { applicationStatusHistory, listSavedOpportunities, opportunityEligibility, saveOpportunity, unsaveOpportunity } from '../services/opportunityDiscovery';
import { opportunityId, opportunityObject } from '../services/opportunityPolicy';
import { ScholarshipError } from '../services/scholarshipPolicy';

const failure = (res: Response, error: unknown) => res.status(error instanceof ScholarshipError ? error.statusCode : 503).json({ success: false, message: error instanceof ScholarshipError ? error.message : 'Unable to complete the opportunity operation.' });
const fullSession = (req: Request) => { if (req.user?.requiresEmailVerification && !req.user.emailVerifiedAt) throw new ScholarshipError(403, 'Verify your email before accessing opportunity activity.'); };
export const listSaved = async (req: Request, res: Response) => {
  try { fullSession(req); res.json({ success: true, data: await listSavedOpportunities(req.user!._id, req.query) }); } catch (error) { failure(res, error); }
};
export const saveListing = async (req: Request, res: Response) => {
  try { fullSession(req); opportunityObject(req.body ?? {}, []); const saved = await saveOpportunity(req.user!._id, req.params.id); res.json({ success: true, data: { saved: { _id: saved._id, opportunityId: saved.opportunityId, savedAt: saved.createdAt } } }); } catch (error) { failure(res, error); }
};
export const unsaveListing = async (req: Request, res: Response) => {
  try { fullSession(req); opportunityObject(req.body ?? {}, []); await unsaveOpportunity(req.user!._id, req.params.id); res.json({ success: true, data: { saved: false } }); } catch (error) { failure(res, error); }
};
export const getEligibility = async (req: Request, res: Response) => {
  try { fullSession(req); opportunityObject(req.query, []); res.json({ success: true, data: await opportunityEligibility(req.user!._id, req.params.id) }); } catch (error) { failure(res, error); }
};
export const getApplicationHistory = async (req: Request, res: Response) => {
  try { fullSession(req); res.json({ success: true, data: await applicationStatusHistory(req.user!._id, req.user!.role, req.params.id, req.query) }); } catch (error) { failure(res, error); }
};
