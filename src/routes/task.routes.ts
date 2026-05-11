import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// TODO (Sprint 3): GET   /tasks
// TODO (Sprint 3): POST  /tasks
// TODO (Sprint 3): GET   /tasks/:id
// TODO (Sprint 3): PATCH /tasks/:id/status
// TODO (Sprint 3): PATCH /tasks/:id/assign

export default router
