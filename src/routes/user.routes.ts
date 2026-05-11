import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

// All user routes require authentication
router.use(authenticate)

// TODO (Sprint 2): GET  /users/me
// TODO (Sprint 2): GET  /users         (ADMIN only)
// TODO (Sprint 2): PATCH /users/:id/role (ADMIN only)

export default router
