import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { cacheMiddleware, invalidateCacheMiddleware } from './middleware/cache.middleware'
import './lib/queue' // Initialize queue workers

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/', (_req, res) => {
  res.json({ message: 'XOXO PM Tool API' })
})

app.get('/debug-db', async (_req, res) => {
  try {
    const prismaModule = await import('./lib/prisma');
    const prismaClient = prismaModule.default;
    const url = process.env.DATABASE_URL || '';
    const match = url.match(/@([^/]+)\/([^?]+)/);
    const host = match ? match[1] : 'unknown';
    const dbName = match ? match[2] : 'unknown';

    const clientsCount = await prismaClient.client.count();
    const usersCount = await prismaClient.user.count();

    res.json({
      status: 'ok',
      database: {
        host: host.split(':')[0],
        name: dbName,
      },
      counts: {
        clients: clientsCount,
        users: usersCount,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
import uploadRoutes from './routes/upload.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';
import chatRoutes from './routes/chat.routes';
import subscriptionRoutes from './routes/subscription.routes';

// Distribution endpoints - optionally cache get routes
app.get('/distribution/:projectId', cacheMiddleware(30), getDistributionRule);
app.post('/distribution/:projectId', upsertDistributionRule);
app.post('/distribution/:projectId/schedule', scheduleDistribution);
app.get('/distribution/:projectId/posts', cacheMiddleware(30), getScheduledPosts);
app.patch('/distribution/posts/:postId/lock', lockPost);
app.patch('/distribution/posts/:postId/unlock', unlockPost);


app.use('/auth', authRoutes)
app.use('/users', cacheMiddleware(60), userRoutes)
app.use('/clients', invalidateCacheMiddleware(['/calendar', '/tasks']), cacheMiddleware(60), clientRoutes)
app.use('/tasks', invalidateCacheMiddleware(['/calendar']), cacheMiddleware(60), taskRoutes)
app.use('/calendar', invalidateCacheMiddleware(['/tasks']), cacheMiddleware(60), calendarRoutes)
app.use('/invitations', cacheMiddleware(60), invitationRoutes)
app.use('/audit', cacheMiddleware(60), auditRoutes)
app.use('/packages', invalidateCacheMiddleware(), cacheMiddleware(60), packageRoutes)
app.use('/notifications', invalidateCacheMiddleware(), cacheMiddleware(30), notificationRoutes)
app.use('/storage', uploadRoutes)
app.use('/settings', settingsRoutes)
app.use('/dashboard', cacheMiddleware(30), dashboardRoutes)
app.use('/chat', chatRoutes)
app.use('/subscriptions', invalidateCacheMiddleware(), cacheMiddleware(30), subscriptionRoutes)
app.use('/dashboard', invalidateCacheMiddleware(), cacheMiddleware(30), dashboardRoutes)

export default app