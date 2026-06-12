import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getRetentionPolicy, updateRetentionPolicy } from '../controllers/settings.controller';

const router = Router();

// GET /settings/retention (Admins and Managers)
router.get('/retention', authenticate, authorize(['ADMIN', 'MANAGER']), getRetentionPolicy);

// PUT /settings/retention (Admin only)
router.put('/retention', authenticate, authorize(['ADMIN']), updateRetentionPolicy);

export default router;
