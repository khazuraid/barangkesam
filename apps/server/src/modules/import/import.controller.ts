import type { Prisma } from '@prisma/client';
import type { ImportErrorDetail } from '@repo/types';
import { paginate, paginatedResponse } from '@repo/utils';
import { ImportLogsQuerySchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { delCachePattern } from '../../config/redis.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logActivity } from '../../shared/utils/activityLogger.js';
import { parseAlkesExcel } from '../../shared/utils/excelParser.js';

const ImportBodySchema = z.object({
  group_id: z.string().uuid('group_id harus UUID valid').optional().nullable(),
  group_mapping: z.string().optional(), // JSON string: { "Nama Kit": "id-klaster" }
});

async function getIo() {
  const { getIO } = await import('../../sockets/index.js');
  return getIO();
}

async function emitToUser(userId: string, event: string, data: unknown) {
  const { emitToUser: emit } = await import('../../sockets/index.js');
  emit(userId, event, data);
}

async function findOrCreateAlkesGroup(
  name: string,
  level: number,
  parentId: string | null,
): Promise<{ id: string; name: string; level: number }> {
  const existing = await prisma.alkesGroup.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, level, parent_id: parentId },
  });
  if (existing) return existing;
  return prisma.alkesGroup.create({ data: { name, level, parent_id: parentId } });
}

export async function previewAlkesImport(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'File wajib diupload');

    let parsed;
    try {
      parsed = await parseAlkesExcel(file.buffer);
    } catch (parseErr: any) {
      console.error('Excel parse error:', parseErr);
      throw new AppError(400, `Gagal membaca file Excel: ${parseErr.message}`);
    }
    const { rows } = parsed;

    const detectedGroups = new Map<string, number>();

    let currentL1 = null;
    let currentL2 = null;
    let currentL3 = null;

    for (const row of rows) {
      if (row.type === 'end') break;
      if (row.type === 'L1' && row.name) {
        currentL1 = row.name;
        currentL2 = null;
        currentL3 = null;
      } else if (row.type === 'L2' && row.name) {
        currentL2 = row.name;
        currentL3 = null;
      } else if (row.type === 'L3' && row.name) {
        currentL3 = row.name;
      } else if (row.type === 'data' && row.data) {
        const groupName = currentL3 ?? currentL2 ?? currentL1 ?? 'Lainnya';
        detectedGroups.set(groupName, (detectedGroups.get(groupName) || 0) + 1);
      }
    }

    const groups = Array.from(detectedGroups.entries()).map(([name, count]) => ({ name, count }));

    res.json({ success: true, data: { groups } });
  } catch (err) {
    next(err);
  }
}

export async function importAlkes(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'File wajib diupload');

    const { group_id, group_mapping } = ImportBodySchema.parse(req.body);

    let mapping: Record<string, string> = {};
    if (group_mapping) {
      try {
        mapping = JSON.parse(group_mapping);
      } catch (e) {
        throw new AppError(400, 'Format group_mapping tidak valid');
      }
    }

    if (group_id) {
      const group = await prisma.alkesGroup.findUnique({ where: { id: group_id } });
      if (!group) throw new AppError(404, 'Kelompok default tidak ditemukan');
    }

    const userId = req.user?.userId as string;
    const log = await prisma.importLog.create({
      data: {
        type: 'ALKES',
        filename: file.originalname,
        status: 'PROCESSING',
        created_by: userId,
      } as Prisma.ImportLogUncheckedCreateInput,
    });

    const io = await getIo();
    io.emit('import:progress', { log_id: log.id, processed: 0, total: 0, pct: 0 });

    let rows, parseErrors;
    try {
      const parsed = await parseAlkesExcel(file.buffer);
      rows = parsed.rows;
      parseErrors = parsed.errors;
    } catch (parseErr: any) {
      console.error('Excel parse error in importAlkes:', parseErr);
      await prisma.importLog.update({
        where: { id: log.id },
        data: { status: 'FAIL', error_detail: [{ error: parseErr.message }] },
      });
      throw new AppError(400, `Gagal membaca file Excel: ${parseErr.message}`);
    }

    let currentL1: string | null = null;
    let currentL2: string | null = null;
    let currentL3: string | null = null;

    let success = 0;
    const errors: ImportErrorDetail[] = [...parseErrors];
    let processed = 0;
    const dataRows = rows.filter((r) => r.type === 'data');
    const total = dataRows.length;

    // Cache created groups to avoid redundant queries during this import
    const groupCache = new Map<string, string>();

    for (const row of rows) {
      if (row.type === 'end') break;

      if (row.type === 'L1' && row.name) {
        currentL1 = row.name;
        currentL2 = null;
        currentL3 = null;
      } else if (row.type === 'L2' && row.name) {
        currentL2 = row.name;
        currentL3 = null;
      } else if (row.type === 'L3' && row.name) {
        currentL3 = row.name;
      } else if (row.type === 'data' && row.data) {
        processed++;
        const groupName = currentL3 ?? currentL2 ?? currentL1 ?? 'Lainnya';

        // Skip insertion if the group was not selected/mapped in the frontend
        if (!mapping[groupName]) {
          const pct = total > 0 ? Math.round((processed / total) * 100) : 100;
          if (processed % 10 === 0 || processed === total) {
            io.emit('import:progress', { log_id: log.id, processed, total, pct });
          }
          continue;
        }

        let targetGroupId: string | null = group_id ?? null;

        // Find or create the sub-group under the mapped cluster
        const parentClusterId = mapping[groupName];
        const cacheKey = `${parentClusterId}-${groupName}`;

        if (groupCache.has(cacheKey)) {
          targetGroupId = groupCache.get(cacheKey) as string;
        } else {
          // Get parent cluster to determine level
          const parentCluster = await prisma.alkesGroup.findUnique({
            where: { id: parentClusterId },
          });
          const targetLevel = parentCluster ? parentCluster.level + 1 : 2;

          const subGroup = await findOrCreateAlkesGroup(groupName, targetLevel, parentClusterId);
          groupCache.set(cacheKey, subGroup.id);
          targetGroupId = subGroup.id;
        }

        try {
          await prisma.alkes.upsert({
            where: { kode_alat: row.data.kode_alat },
            create: {
              ...row.data,
              group_id: targetGroupId,
              created_by: userId,
              verification_status: 'DRAFT', // Harus dicek dan diedit dulu oleh staf
            } as Prisma.AlkesUncheckedCreateInput,
            update: {
              ...row.data,
              group_id: targetGroupId,
              verification_status: 'DRAFT',
            } as Prisma.AlkesUncheckedUpdateInput,
          });
          success++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ row: row.row ?? 0, kode: row.data.kode_alat, error: msg });
        }

        const pct = total > 0 ? Math.round((processed / total) * 100) : 100;
        io.emit('import:progress', { log_id: log.id, processed, total, pct });
      }
    }

    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'DONE',
        total_rows: total,
        success_rows: success,
        failed_rows: errors.length,
        error_detail: errors as object[],
      },
    });

    const notif = await prisma.notification.create({
      data: {
        user_id: userId,
        title: 'Import Alkes Selesai',
        message: `Import ${file.originalname}: ${success} berhasil, ${errors.length} gagal. Membutuhkan verifikasi fisik.`,
        type: errors.length > 0 ? 'WARNING' : 'SUCCESS',
      } as Prisma.NotificationUncheckedCreateInput,
    });

    await emitToUser(userId, 'notification:new', {
      id: notif.id,
      title: notif.title,
      type: notif.type,
      link: null,
    });

    await delCachePattern('alkes:*');
    await delCachePattern('dashboard:*');

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'IMPORT',
        entity: 'alkes',
        entityId: log.id,
        description: `Import alkes selesai (${success} sukses, ${errors.length} gagal)`,
        metadata: {
          filename: file.originalname,
          group_id,
          total,
          success,
          failed: errors.length,
        },
        req,
      });
    }

    io.emit('import:completed', { log_id: log.id, success, failed: errors.length, errors });

    res.json({
      success: true,
      data: { log_id: log.id, total, success, failed: errors.length, errors },
    });
  } catch (err) {
    next(err);
  }
}

export async function getLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const query = ImportLogsQuerySchema.parse(req.query);
    const { page, limit } = query;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.ImportLogWhereInput = {};

    const [data, total] = await Promise.all([
      prisma.importLog.findMany({
        where,
        skip,
        take,
        include: { creator: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.importLog.count({ where }),
    ]);

    res.json({ success: true, data: paginatedResponse(data, total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function getLogById(req: Request, res: Response, next: NextFunction) {
  try {
    const log = await prisma.importLog.findUnique({
      where: { id: req.params.id },
      include: { creator: { select: { name: true } } },
    });
    if (!log) throw new AppError(404, 'Log tidak ditemukan');
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

export async function deleteLog(req: Request, res: Response, next: NextFunction) {
  try {
    const log = await prisma.importLog.findUnique({ where: { id: req.params.id } });
    if (!log) throw new AppError(404, 'Log tidak ditemukan');
    await prisma.importLog.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Log berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function deleteLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const before = req.query.before as string;
    if (!before) throw new AppError(400, 'Query parameter "before" (YYYY-MM-DD) wajib diisi');
    const date = new Date(before);
    if (Number.isNaN(date.getTime())) throw new AppError(400, 'Format tanggal tidak valid');

    const { count } = await prisma.importLog.deleteMany({ where: { created_at: { lt: date } } });
    res.json({ success: true, message: `${count} log berhasil dihapus` });
  } catch (err) {
    next(err);
  }
}
