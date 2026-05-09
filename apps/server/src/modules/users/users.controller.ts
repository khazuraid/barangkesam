import { paginate, paginatedResponse } from '@repo/utils';
import {
  CreateUserSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  UsersQuerySchema,
} from '@repo/validators';
import argon2 from 'argon2';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logActivity } from '../../shared/utils/activityLogger.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, q, role, is_active } = UsersQuerySchema.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (typeof is_active === 'boolean') where.is_active = is_active;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          assigned_room_id: true,
          last_login_at: true,
          created_at: true,
          assigned_room: { select: { id: true, name: true, level: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: paginatedResponse(data, total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = CreateUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new AppError(409, 'Email sudah digunakan');
    const hashed = await argon2.hash(body.password);

    if (body.role !== 'ADMIN' && !body.assigned_room_id) {
      throw new AppError(400, 'Ruangan wajib dipilih untuk role selain Admin');
    }

    const user = await prisma.user.create({
      data: {
        ...body,
        assigned_room_id: body.role === 'ADMIN' ? null : body.assigned_room_id,
        password: hashed,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        assigned_room_id: true,
        last_login_at: true,
        created_at: true,
      },
    });
    logActivity({
      userId: req.user?.userId || user.id,
      action: 'CREATE',
      entity: 'users',
      entityId: user.id,
      description: `User dibuat: ${user.email}`,
      req,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar_url: true,
        is_active: true,
        assigned_room_id: true,
        last_login_at: true,
        created_at: true,
        assigned_room: { select: { id: true, name: true, level: true } },
      },
    });
    if (!user) throw new AppError(404, 'User tidak ditemukan');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const body = UpdateUserSchema.parse(req.body);

    if (
      id === req.user?.userId &&
      typeof body.is_active === 'boolean' &&
      body.is_active === false
    ) {
      throw new AppError(400, 'Tidak bisa menonaktifkan akun sendiri');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { role: true, assigned_room_id: true },
    });
    if (!existing) throw new AppError(404, 'User tidak ditemukan');

    const nextRole = body.role ?? existing.role;
    const nextAssignedRoomId =
      body.assigned_room_id !== undefined ? body.assigned_room_id : existing.assigned_room_id;

    if (nextRole !== 'ADMIN' && !nextAssignedRoomId) {
      throw new AppError(400, 'Ruangan wajib dipilih untuk role selain Admin');
    }

    const data: Record<string, unknown> = { ...body };
    if (body.password) {
      data.password = await argon2.hash(body.password);
    }

    if (nextRole === 'ADMIN') {
      data.assigned_room_id = null;
    } else {
      data.assigned_room_id = nextAssignedRoomId;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        assigned_room_id: true,
        last_login_at: true,
      },
    });

    logActivity({
      userId: req.user?.userId || user.id,
      action: 'UPDATE',
      entity: 'users',
      entityId: user.id,
      description: `User diperbarui: ${user.email}`,
      metadata: { fields: Object.keys(body) },
      req,
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    if (id === req.user?.userId) throw new AppError(400, 'Tidak bisa menonaktifkan akun sendiri');

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, is_active: true },
    });
    if (!existing) throw new AppError(404, 'User tidak ditemukan');

    const user = await prisma.user.update({
      where: { id },
      data: { is_active: !existing.is_active },
      select: { id: true, name: true, email: true, role: true, is_active: true },
    });

    logActivity({
      userId: req.user?.userId || user.id,
      action: 'TOGGLE_ACTIVE',
      entity: 'users',
      entityId: user.id,
      description: `Status user diubah menjadi ${user.is_active ? 'aktif' : 'nonaktif'}`,
      req,
    });
    res.json({ success: true, data: user, message: 'Status user berhasil diubah' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { password } = ResetPasswordSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new AppError(404, 'User tidak ditemukan');

    const hashed = await argon2.hash(password);
    await prisma.user.update({ where: { id }, data: { password: hashed } });

    logActivity({
      userId: req.user?.userId || id,
      action: 'RESET_PASSWORD',
      entity: 'users',
      entityId: id,
      description: 'Password user direset oleh admin',
      req,
    });

    res.json({ success: true, message: 'Password user berhasil direset' });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    if (id === req.user?.userId) throw new AppError(400, 'Tidak bisa menghapus akun sendiri');
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!existing) throw new AppError(404, 'User tidak ditemukan');

    await prisma.user.delete({ where: { id } });

    logActivity({
      userId: req.user?.userId || existing.id,
      action: 'DELETE',
      entity: 'users',
      entityId: existing.id,
      description: `User dihapus: ${existing.email}`,
      req,
    });

    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
