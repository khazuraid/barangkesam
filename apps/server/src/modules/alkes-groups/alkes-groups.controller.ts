import { CreateAlkesGroupSchema, UpdateAlkesGroupSchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { CacheKeys, delCache, getCache, setCache } from '../../config/redis.js';
import { AppError } from '../../middlewares/errorHandler.js';

type GroupNode = {
  id: string;
  level: number;
  name: string;
  parent_id: string | null;
  created_at: Date;
  children: GroupNode[];
  _count?: { alkes: number };
};

function buildTree(groups: GroupNode[]): GroupNode[] {
  const map = new Map(groups.map((g) => [g.id, { ...g, children: [] as GroupNode[] }]));
  const roots: GroupNode[] = [];
  for (const g of map.values()) {
    if (g.parent_id) {
      map.get(g.parent_id)?.children.push(g);
    } else {
      roots.push(g);
    }
  }
  return roots;
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const cached = await getCache(CacheKeys.alkesGroups());
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const groups = await prisma.alkesGroup.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { alkes: true } } },
    });
    const tree = buildTree(groups as GroupNode[]);
    await setCache(CacheKeys.alkesGroups(), tree, 3600);
    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = CreateAlkesGroupSchema.parse(req.body);
    if (body.parent_id) {
      const parent = await prisma.alkesGroup.findUnique({ where: { id: body.parent_id } });
      if (!parent) throw new AppError(404, 'Kelompok induk tidak ditemukan');
      if (parent.level >= body.level)
        throw new AppError(400, 'Level harus lebih besar dari kelompok induk');
    }
    const group = await prisma.alkesGroup.create({ data: body });
    await delCache(CacheKeys.alkesGroups());
    res.status(201).json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await prisma.alkesGroup.findUnique({
      where: { id: req.params.id },
      include: {
        children: { include: { children: true, _count: { select: { alkes: true } } } },
        _count: { select: { alkes: true } },
      },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const body = UpdateAlkesGroupSchema.parse(req.body);
    const group = await prisma.alkesGroup.update({ where: { id: req.params.id }, data: body });
    await delCache(CacheKeys.alkesGroups());
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const [alkesCount, childCount] = await Promise.all([
      prisma.alkes.count({ where: { group_id: req.params.id } }),
      prisma.alkesGroup.count({ where: { parent_id: req.params.id } }),
    ]);
    if (alkesCount > 0) throw new AppError(409, `Kelompok masih memiliki ${alkesCount} alkes`);
    if (childCount > 0)
      throw new AppError(409, `Kelompok masih memiliki ${childCount} sub-kelompok`);
    await prisma.alkesGroup.delete({ where: { id: req.params.id } });
    await delCache(CacheKeys.alkesGroups());
    res.json({ success: true, message: 'Kelompok berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
