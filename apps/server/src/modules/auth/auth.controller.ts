import { ChangePasswordSchema, LoginSchema, UpdateProfileSchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logActivity } from '../../shared/utils/activityLogger.js';
import * as authService from './auth.service.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = LoginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password);
    logActivity({
      userId: result.user.id,
      action: 'LOGIN',
      entity: 'auth',
      entityId: result.user.id,
      description: `Login berhasil: ${result.user.email}`,
      req,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError(401, 'Token tidak ditemukan');
    const token = authHeader.slice(7);
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');
    await authService.logout(token, userId);
    logActivity({
      userId,
      action: 'LOGOUT',
      entity: 'auth',
      entityId: userId,
      description: 'Logout berhasil',
      req,
    });
    res.json({ success: true, message: 'Berhasil logout' });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };
    if (!refresh_token) {
      res.status(400).json({ success: false, error: 'refresh_token wajib diisi' });
      return;
    }
    const result = await authService.refreshToken(refresh_token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar_url: true,
        is_active: true,
        assigned_room_id: true,
        created_at: true,
        assigned_room: { select: { id: true, name: true, level: true } },
      },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');
    const body = UpdateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar_url: true,
        assigned_room_id: true,
        assigned_room: { select: { id: true, name: true, level: true } },
      },
    });
    logActivity({
      userId,
      action: 'UPDATE',
      entity: 'user_profile',
      entityId: userId,
      description: 'Profil user diperbarui',
      metadata: { fields: Object.keys(body) },
      req,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');
    const body = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(userId, body.current_password, body.new_password);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    next(err);
  }
}
