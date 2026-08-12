import { Router } from 'express';
import { getPublicProviderProfile } from '../controllers/providerController';

const router = Router();

router.get('/:id', getPublicProviderProfile);

export default router;
