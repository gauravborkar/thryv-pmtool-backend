import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export function initializeSocket(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // For development
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, User: ${(socket as any).user.id}`);

    socket.on('join_channel', (channelId: number) => {
      socket.join(`channel_${channelId}`);
      console.log(`User ${(socket as any).user.id} joined channel_${channelId}`);
    });

    socket.on('leave_channel', (channelId: number) => {
      socket.leave(`channel_${channelId}`);
    });

    socket.on('typing_start', ({ channelId, userName }: { channelId: number, userName: string }) => {
      socket.to(`channel_${channelId}`).emit('user_typing', { userName, channelId });
    });

    socket.on('typing_end', ({ channelId, userName }: { channelId: number, userName: string }) => {
      socket.to(`channel_${channelId}`).emit('user_stopped_typing', { userName, channelId });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}
