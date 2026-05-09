import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env, isCorsOriginAllowed } from '../config/env.js';
import type { AuthPayload } from '../middlewares/auth.js';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isCorsOriginAllowed(origin));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // SEC-07 FIX: autentikasi Socket.IO via token di handshake
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined)?.replace('Bearer ', '');

    if (!token) {
      // Izinkan koneksi tanpa auth untuk monitoring publik (hanya terima event non-sensitif)
      // Untuk production, ganti dengan: return next(new Error('Authentication required'));
      socket.data.userId = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      // Join room per user untuk emit notifikasi personal
      socket.join(`user:${payload.userId}`);
      next();
    } catch {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string | null;
    console.log(`🔌 Socket connected: ${socket.id}${userId ? ` (user: ${userId})` : ' (guest)'}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO belum diinisialisasi');
  return io;
}

/** Emit ke room user tertentu (notifikasi personal) */
export function emitToUser(userId: string, event: string, data: unknown): void {
  getIO().to(`user:${userId}`).emit(event, data);
}
