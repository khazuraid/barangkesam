import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import type { AuthPayload } from '../../middlewares/auth.js';
import { AppError } from '../../middlewares/errorHandler.js';

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { assigned_room: { select: { id: true, name: true, level: true } } },
  });
  if (!user) throw new AppError(401, 'Email atau password salah');
  if (!user.is_active) throw new AppError(401, 'Akun tidak aktif');

  const valid = await argon2.verify(user.password, password);
  if (!valid) throw new AppError(401, 'Email atau password salah');

  const payload: AuthPayload = { userId: user.id, role: user.role };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  // Simpan refresh token di Redis (7 hari)
  await redis.setex(`session:${user.id}`, 7 * 24 * 3600, refreshToken);

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, accessToken, refreshToken };
}

export async function logout(token: string, userId: string) {
  // Blacklist access token (1 jam)
  await redis.setex(`blacklist:${token}`, 3600, '1');
  // Hapus session
  await redis.del(`session:${userId}`);
}

export async function refreshToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;

    // Cek session masih valid
    const stored = await redis.get(`session:${payload.userId}`);
    if (!stored || stored !== token) throw new AppError(401, 'Refresh token tidak valid');

    const newPayload: AuthPayload = { userId: payload.userId, role: payload.role };
    const accessToken = jwt.sign(newPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return { accessToken };
  } catch {
    throw new AppError(401, 'Refresh token tidak valid atau sudah kadaluarsa');
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const valid = await argon2.verify(user.password, currentPassword);
  if (!valid) throw new AppError(400, 'Password lama tidak sesuai');

  const hashed = await argon2.hash(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  // Invalidate semua session
  await redis.del(`session:${userId}`);
}
