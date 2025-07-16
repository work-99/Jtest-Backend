import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

interface AuthenticatedSocket {
  userId: string;
  userEmail: string;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const authenticatedSocket = socket as any;
        authenticatedSocket.userId = decoded.userId || decoded.sub;
        authenticatedSocket.userEmail = decoded.email;
        
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket: any) => {
      console.log(`User ${socket.userId} connected`);
      
      // Join user-specific room
      socket.join(`user:${socket.userId}`);
      
      // Track user's sockets
      const userSockets = this.userSockets.get(socket.userId) || [];
      userSockets.push(socket.id);
      this.userSockets.set(socket.userId, userSockets);

      // Handle chat messages
      socket.on('chat_message', async (data: any) => {
        try {
          // Emit to all user's connected clients
          this.io?.to(`user:${socket.userId}`).emit('chat_message', {
            ...data,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Error handling chat message:', error);
        }
      });

      // Handle task updates
      socket.on('task_update', async (data: any) => {
        try {
          this.io?.to(`user:${socket.userId}`).emit('task_update', {
            ...data,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Error handling task update:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        
        // Remove socket from tracking
        const userSockets = this.userSockets.get(socket.userId) || [];
        const updatedSockets = userSockets.filter(id => id !== socket.id);
        
        if (updatedSockets.length === 0) {
          this.userSockets.delete(socket.userId);
        } else {
          this.userSockets.set(socket.userId, updatedSockets);
        }
      });
    });

    console.log('WebSocket service initialized');
  }

  // Send message to specific user
  sendToUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date()
      });
    }
  }

  // Send task update to user
  sendTaskUpdate(userId: string, task: any) {
    this.sendToUser(userId, 'task_update', task);
  }

  // Send chat message to user
  sendChatMessage(userId: string, message: any) {
    this.sendToUser(userId, 'chat_message', message);
  }

  // Send notification to user
  sendNotification(userId: string, notification: any) {
    this.sendToUser(userId, 'notification', notification);
  }

  // Send proactive agent update
  sendProactiveUpdate(userId: string, update: any) {
    this.sendToUser(userId, 'proactive_update', update);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Get number of connected users
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }
}

export const webSocketService = new WebSocketService(); 