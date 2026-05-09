import { paginate, paginatedResponse } from '@repo/utils';
import { ActivityLogsQuerySchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, action, entity, entity_id, user_id, from, to, q } =
      ActivityLogsQuerySchema.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (entity_id) where.entity_id = entity_id;
    if (user_id) where.user_id = user_id;
    if (q) where.description = { contains: q, mode: 'insensitive' };
    if (from || to) {
      where.created_at = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ success: true, data: paginatedResponse(data, total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const log = await prisma.activityLog.findUnique({
      where: { id: req.params.id as string },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!log) {
      res.status(404).json({ success: false, error: 'Log tidak ditemukan' });
      return;
    }
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}
