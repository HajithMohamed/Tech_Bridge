import type { Request, Response } from 'express';
import { bearerToken } from '../utils/bearer';
import { verifyToken } from '../utils/jwt';
import { AnalyticsError, type AnalyticsRole } from '../services/analyticsPolicy';
import { readPlatformAnalytics, type AnalyticsSession } from '../services/platformAnalytics';

function analyticsSession(req: Request): AnalyticsSession {
  try {
    const decoded = verifyToken(bearerToken(req.headers.authorization)!);
    if (decoded.scope !== undefined || !req.user) throw new Error('Restricted session.');
    return { id: req.user._id, role: req.user.role as AnalyticsRole, version: decoded.version ?? 0 };
  } catch { throw new AnalyticsError(401, 'A current full session is required.'); }
}
const handler = (view: 'summary' | 'impact' | 'provider') => async (req: Request, res: Response) => {
  try {
    const data = await readPlatformAnalytics(analyticsSession(req), req.query, view);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error instanceof AnalyticsError ? error.statusCode : 503).json({ success: false, message: error instanceof AnalyticsError ? error.message : 'Analytics services are temporarily unavailable.' });
  }
};
export const getRoleAnalytics = handler('summary');
export const getImpactAnalytics = handler('impact');
export const getProviderAnalyticsDashboard = handler('provider');
