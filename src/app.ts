import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { cacheMiddleware } from './middleware/cache.middleware'
import './lib/queue' // Initialize queue workers

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/', (_req, res) => {
  res.json({ message: 'XOXO PM Tool API' })
})

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import clientRoutes from './routes/client.routes'
import taskRoutes from './routes/task.routes'
import calendarRoutes from './routes/calendar.routes'
import invitationRoutes from './routes/invitation.routes'
import auditRoutes from './routes/audit.routes';
import packageRoutes from './routes/package.routes';
import notificationRoutes from './routes/notification.routes';
import { getDistributionRule, upsertDistributionRule, scheduleDistribution, getScheduledPosts, lockPost, unlockPost } from './controllers/distribution.controller';

// Distribution endpoints - optionally cache get routes
app.get('/distribution/:projectId', cacheMiddleware(30), getDistributionRule);
app.post('/distribution/:projectId', upsertDistributionRule);
app.post('/distribution/:projectId/schedule', scheduleDistribution);
app.get('/distribution/:projectId/posts', cacheMiddleware(30), getScheduledPosts);
app.patch('/distribution/posts/:postId/lock', lockPost);
app.patch('/distribution/posts/:postId/unlock', unlockPost);


app.use('/auth', authRoutes)
app.use('/users', cacheMiddleware(60), userRoutes)
app.use('/clients', cacheMiddleware(60), clientRoutes)
app.use('/tasks', cacheMiddleware(60), taskRoutes)
app.use('/calendar', cacheMiddleware(60), calendarRoutes)
app.use('/invitations', cacheMiddleware(60), invitationRoutes)
app.use('/audit', cacheMiddleware(60), auditRoutes)
app.use('/packages', cacheMiddleware(60), packageRoutes)
app.use('/notifications', cacheMiddleware(30), notificationRoutes)

export default app

