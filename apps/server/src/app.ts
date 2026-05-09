import 'dotenv/config';
import { createServer } from 'node:http';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { UPLOADS_DIR, USE_LOCAL_STORAGE } from './config/cloudinary.js';
import { prisma } from './config/database.js';
import { corsOrigins, env, isCorsOriginAllowed } from './config/env.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { initSocket } from './sockets/index.js';

import activityLogsRoute from './modules/activity-logs/activity-logs.route.js';
import alkesGroupsRoute from './modules/alkes-groups/alkes-groups.route.js';
import alkesPublicRoute from './modules/alkes/alkes.public.route.js';
import alkesRoute from './modules/alkes/alkes.route.js';
// Routes
import authRoute from './modules/auth/auth.route.js';
import dashboardRoute from './modules/dashboard/dashboard.route.js';
import requestsRoute from './modules/equipment-requests/equipment-requests.route.js';
import exportRoute from './modules/export/export.route.js';
import importRoute from './modules/import/import.route.js';
import notificationsRoute from './modules/notifications/notifications.route.js';
import usersRoute from './modules/users/users.route.js';

const app = express();
const httpServer = createServer(app);

// Beritahu Express bahwa kita di balik proxy (Coolify/Traefik)
app.set('trust proxy', 1);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
initSocket(httpServer);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  helmet({
    // Izinkan serve gambar lokal lintas-origin (frontend di :3000 akses /uploads di :3001)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
// Konfigurasi CORS yang mendukung banyak origin (localhost + LAN IP untuk akses dari HP).
// Gunakan callback dengan `false` (bukan throw Error) agar request yang ditolak tidak
// memicu error 500 — cukup tidak mengirim header `Access-Control-Allow-Origin` saja.
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = isCorsOriginAllowed(origin);
    if (!allowed) {
      // Log agar mudah debug saat konfigurasi belum tepat
      console.warn(`⚠️  CORS blocked origin: ${origin ?? '(no origin)'}`);
    }
    callback(null, allowed);
  },
  credentials: true,
};

app.use(cors(corsOptions));
// Pastikan preflight `OPTIONS` ter-handle untuk semua route
app.options('*', cors(corsOptions));

// Static files — hanya aktif saat memakai penyimpanan lokal
if (USE_LOCAL_STORAGE) {
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(compression() as unknown as import('express').RequestHandler);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 200,
    message: { success: false, error: 'Terlalu banyak request, coba lagi nanti' },
  }) as unknown as import('express').RequestHandler,
);

// ─── Routes ───────────────────────────────────────────────────────────────────
// Public (no auth) endpoints — HARUS didaftarkan SEBELUM route ter-auth agar
// middleware auth di route lain tidak memengaruhi endpoint publik.
app.use('/api/public', alkesPublicRoute);

app.use('/api/auth', authRoute);
app.use('/api/activity-logs', activityLogsRoute);
app.use('/api/users', usersRoute);
app.use('/api/alkes/groups', alkesGroupsRoute);
app.use('/api/alkes', alkesRoute);
app.use('/api/requests', requestsRoute);
app.use('/api/import', importRoute);
app.use('/api/export', exportRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/notifications', notificationsRoute);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan' });
});

// Error handler
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    // ioredis tidak punya .connect() — koneksi otomatis, verifikasi dengan ping
    await redis.ping();
    console.log('✅ Redis connected');

    httpServer.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log('📡 Socket.IO ready');
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🛡️  CORS origins: ${corsOrigins.join(', ') || '(none)'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
