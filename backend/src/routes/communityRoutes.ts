import { Router } from 'express';
import { authorize, protect, protectVerification } from '../middleware/auth';
import { communityClaimHistory, communityDecision, getOwnCommunityClaim, listCommunityClaims, listCommunityPeople, saveOwnCommunityProfile, submitOwnCommunityClaim } from '../controllers/communityController';

const noStore = (_req: unknown, res: { set: (name: string, value: string) => unknown }, next: () => void) => { res.set('Cache-Control', 'no-store'); next(); };
export function communityRoutes() {
  const router = Router(); router.use(noStore);
  router.get('/people', protect, listCommunityPeople);
  router.use('/claim', protectVerification);
  router.get('/claim', getOwnCommunityClaim);
  router.post('/claim', submitOwnCommunityClaim);
  router.put('/claim/profile', saveOwnCommunityProfile);
  router.get('/claim/history', communityClaimHistory(false));
  return router;
}
export function adminCommunityRoutes() {
  const router = Router(); router.use(protect, authorize('admin'), noStore);
  router.get('/', listCommunityClaims);
  router.get('/:id/history', communityClaimHistory(true));
  for (const action of ['approve', 'reject', 'request-info', 'revoke']) router.patch(`/:id/${action}`, communityDecision(action));
  return router;
}
