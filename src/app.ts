import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes     from './routes/auth.routes'
import userRoutes     from './routes/user.routes'
import clientRoutes   from './routes/client.routes'
import taskRoutes     from './routes/task.routes'
import calendarRoutes from './routes/calendar.routes'
import { errorHandler } from './middleware/error.middleware'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// Health & root
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
app.get('/', (_req, res) => {
  res.json({ message: 'Thryv PM Tool API' })
})

// API routes
app.use('/api/v1/auth',     authRoutes)
app.use('/api/v1/users',    userRoutes)
app.use('/api/v1/clients',  clientRoutes)
app.use('/api/v1/tasks',    taskRoutes)
app.use('/api/v1/calendar', calendarRoutes)

// Global error handler (must be last)
app.use(errorHandler)

export default app

