import type { Prisma } from '@prisma/client';
import { paginate, paginatedResponse } from '@repo/utils';
import { NotificationsQuerySchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';

function getUserId(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, 'Tidak terautentikasi');
  return userId;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const query = NotificationsQuerySchema.parse(req.query);
    const { page, limit, is_read } = query;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (is_read !== undefined) where.is_read = is_read;
    const [data, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    res.json({ success: true, data: paginatedResponse(data, total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const count = await prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id, user_id: userId },
    });
    if (!notif) throw new AppError(404, 'Notifikasi tidak ditemukan');
    if (!notif.is_read) {
      await prisma.notification.update({ where: { id: req.params.id }, data: { is_read: true } });
    }
    res.json({ success: true, data: { ...notif, is_read: true } });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await prisma.notification.updateMany({
      where: { id: req.params.id, user_id: userId },
      data: { is_read: true },
    });
    res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await prisma.notification.deleteMany({
      where: { id: req.params.id, user_id: userId },
    });
    res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function removeAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (req.query.is_read === 'true') where.is_read = true;
    await prisma.notification.deleteMany({ where });
    res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
