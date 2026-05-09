import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('placeholder-secret-key-32-characters-minimum-length'),
  JWT_REFRESH_SECRET: z.string().default('placeholder-refresh-secret-key-32-characters-minimum'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  API_URL: z.string().default('http://localhost:3001'),
  /**
   * Daftar origin yang diizinkan oleh CORS. Dapat diisi:
   *  - satu origin: `http://localhost:3000`
   *  - banyak origin (comma-separated): `http://localhost:3000,http://192.168.0.153:3000`
   *  - wildcard pattern per-segment: `http://192.168.*.*:3000`
   *  - `*` untuk mengizinkan semua (hati-hati, hanya untuk dev).
   */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Daftar origin CORS yang sudah di-parse menjadi array
 * (hasil split pada koma dan trim spasi).
 */
export const corsOrigins: string[] = env.CORS_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Mengubah pola wildcard sederhana (`*`) menjadi regex.
 * Contoh: `http://192.168.*.*:3000` → match `http://192.168.0.153:3000`.
 */
const patternToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
};

const originMatchers: Array<(origin: string) => boolean> = corsOrigins.map((entry) => {
  if (entry === '*') return () => true;
  if (entry.includes('*')) {
    const re = patternToRegex(entry);
    return (origin: string) => re.test(origin);
  }
  return (origin: string) => origin === entry;
});

/**
 * Predikat untuk memutuskan apakah sebuah origin diizinkan.
 * Digunakan oleh middleware `cors()` agar mendukung banyak origin sekaligus,
 * termasuk akses dari LAN IP (HP) dan localhost.
 */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  // request tanpa Origin (mis. curl, server-to-server, same-origin) → izinkan
  if (!origin) return true;
  return originMatchers.some((match) => match(origin));
}
