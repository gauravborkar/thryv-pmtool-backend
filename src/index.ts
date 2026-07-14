import 'dotenv/config'

import http from 'http'
import app from './app'
import { initializeSocket } from './services/socket.service'

const port = process.env.PORT || 3001
const server = http.createServer(app)

initializeSocket(server)

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`)
})