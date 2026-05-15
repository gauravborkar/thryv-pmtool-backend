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

app.use('/auth', authRoutes)
app.use('/users', userRoutes)


export default app

