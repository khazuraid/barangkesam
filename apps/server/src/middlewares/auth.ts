import type { UserRole } from '@repo/types';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { AppError } from './errorHandler.js';

export interface AuthPayload {
  userId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      // Narrow params to simple string map — matches Express runtime behavior
      // and avoids `string | string[]` noise from express v5 types.
      params: Record<string, string>;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Token tidak ditemukan');
    }

    const token = authHeader.slice(7);

    // Cek blacklist
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) throw new AppError(401, 'Token tidak valid');

    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    // Cek user masih aktif
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { is_active: true },
    });
    if (!user?.is_active) throw new AppError(401, 'Akun tidak aktif');

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, 'Token tidak valid atau sudah kadaluarsa'));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Tidak terautentikasi'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Tidak memiliki akses'));
    }
    next();
  };
}
