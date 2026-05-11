import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// TODO (Sprint 3): GET    /clients
// TODO (Sprint 3): POST   /clients
// TODO (Sprint 3): GET    /clients/:id
// TODO (Sprint 3): PATCH  /clients/:id
// TODO (Sprint 3): DELETE /clients/:id

export default router
