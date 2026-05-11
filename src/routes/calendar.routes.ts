import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// TODO (Sprint 3): GET  /calendar?clientId=&month=
// TODO (Sprint 3): POST /calendar

export default router
