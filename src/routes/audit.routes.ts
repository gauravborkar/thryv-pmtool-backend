import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as auditController from '../controllers/audit.controller';

const router = Router();

// GET /audit (Admin only)
router.get('/', authenticate, authorize([1]), auditController.getAuditLogs);

export default router;
