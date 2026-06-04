import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/', (_req, res) => {
  res.json({ message: 'Thryv PM Tool API' })
})

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import clientRoutes from './routes/client.routes'
import taskRoutes from './routes/task.routes'
import calendarRoutes from './routes/calendar.routes'
import invitationRoutes from './routes/invitation.routes'
import auditRoutes from './routes/audit.routes';
import packageRoutes from './routes/package.routes';
import { getDistributionRule, upsertDistributionRule, scheduleDistribution, getScheduledPosts, lockPost, unlockPost } from './controllers/distribution.controller';

// Distribution endpoints
app.get('/distribution/:projectId', getDistributionRule);
app.post('/distribution/:projectId', upsertDistributionRule);
app.post('/distribution/:projectId/schedule', scheduleDistribution);
app.get('/distribution/:projectId/posts', getScheduledPosts);
app.patch('/distribution/posts/:postId/lock', lockPost);
app.patch('/distribution/posts/:postId/unlock', unlockPost);


app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/clients', clientRoutes)
app.use('/tasks', taskRoutes)
app.use('/calendar', calendarRoutes)
app.use('/invitations', invitationRoutes)
app.use('/audit', auditRoutes)
app.use('/packages', packageRoutes)

export default app

