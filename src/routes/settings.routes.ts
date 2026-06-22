import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getRetentionPolicy, updateRetentionPolicy, getSidebarAccess, updateSidebarAccess, getRoles, createRole, deleteRole } from '../controllers/settings.controller';

const router = Router();

// GET /settings/retention (Admins and Managers)
router.get('/retention', authenticate, authorize(['ADMIN', 'MANAGER']), getRetentionPolicy);

// PUT /settings/retention (Admin only)
router.put('/retention', authenticate, authorize(['ADMIN']), updateRetentionPolicy);

// GET /settings/sidebar-access (Any authenticated user so client can check visibility)
router.get('/sidebar-access', authenticate, getSidebarAccess);

// PUT /settings/sidebar-access (Admin only)
router.put('/sidebar-access', authenticate, authorize(['ADMIN']), updateSidebarAccess);

// GET /settings/roles (Admin only)
router.get('/roles', authenticate, authorize(['ADMIN']), getRoles);

// POST /settings/roles (Admin only)
router.post('/roles', authenticate, authorize(['ADMIN']), createRole);

// DELETE /settings/roles/:id (Admin only)
router.delete('/roles/:id', authenticate, authorize(['ADMIN']), deleteRole);

export default router;
