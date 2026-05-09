import { Prisma } from '@prisma/client';
import { paginate, paginatedResponse } from '@repo/utils';
import {
  AlkesQuerySchema,
  CreateAlkesSchema,
  RejectSchema,
  UpdateAlkesSchema,
} from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { deleteFromCloudinary } from '../../config/cloudinary.js';
import { prisma } from '../../config/database.js';
import { CacheKeys, delCache, delCachePattern, getCache, setCache } from '../../config/redis.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { BERFUNGSI_RUSAK_VALUES } from '../../shared/constants/enums.js';
import { logActivity } from '../../shared/utils/activityLogger.js';
import {
  broadcastVerificationEvent,
  logVerification,
  notifyAdmins,
  notifyUser,
} from '../../shared/utils/verificationLogger.js';

/**
 * Ambil `assigned_room_id` untuk user dengan role yang dibatasi ruangan
 * (STAFF & MANAGER). ADMIN selalu return null (tanpa batasan).
 */
async function getRestrictedRoomId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, assigned_room_id: true },
  });

  if (!user) return null;
  if (user.role === 'ADMIN') return null;

  if (!user.assigned_room_id) {
    const label = user.role === 'MANAGER' ? 'manager' : 'staff';
    throw new AppError(403, `Akun ${label} belum di-assign ke ruangan`);
  }

  return user.assigned_room_id;
}

// Backward-compat alias untuk pemanggil lama
const getStaffAssignedRoom = getRestrictedRoomId;

const ALKES_SELECT = {
  id: true,
  group_id: true,
  mark: true,
  kode_alat: true,
  nama_alat: true,
  ada: true,
  no_seri: true,
  merk: true,
  type: true,
  thn_pengadaan: true,
  berfungsi: true,
  harga: true,
  pendanaan: true,
  distributor: true,
  akl_akd: true,
  keterangan: true,
  image_url: true,
  verification_status: true,
  verified_by: true,
  verified_at: true,
  rejection_reason: true,
  submitted_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} as const;

/** Tangkap Prisma P2025 (record not found) dan lempar AppError 404 */
function handlePrismaError(err: unknown, entity = 'Data'): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw new AppError(404, `${entity} tidak ditemukan`);
  }
  throw err;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = AlkesQuerySchema.parse(req.query);
    const { page, limit, group_id, ada, berfungsi, pendanaan, verification_status, mine, search, from_date, to_date, sort_by, order } =
      query;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.AlkesWhereInput = {};
    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    const targetGroupId = staffRoomId || group_id;
    
    if (targetGroupId) {
      // Get target group and its children up to 2 levels down (L1 -> L2 -> L3)
      const allowedIds = [targetGroupId];
      const children = await prisma.alkesGroup.findMany({
        where: { parent_id: targetGroupId },
        select: { id: true },
      });
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        allowedIds.push(...childIds);
        const grandchildren = await prisma.alkesGroup.findMany({
          where: { parent_id: { in: childIds } },
          select: { id: true },
        });
        allowedIds.push(...grandchildren.map(c => c.id));
      }
      where.group_id = { in: allowedIds };
    }

    if (ada) where.ada = ada as 'Ya' | 'Tidak';
    if (berfungsi) where.berfungsi = berfungsi as Prisma.EnumAlkesBerfungsiFilter;
    if (pendanaan) where.pendanaan = pendanaan as Prisma.EnumAlkesPendanaanNullableFilter;
    if (verification_status) {
      where.verification_status = verification_status as Prisma.EnumVerificationStatusFilter;
    }
    if (mine && req.user?.userId) {
      where.created_by = req.user.userId;
    }
    if (search) {
      where.OR = [
        { nama_alat: { contains: search, mode: 'insensitive' } },
        { kode_alat: { contains: search, mode: 'insensitive' } },
        { no_seri: { contains: search, mode: 'insensitive' } },
        { merk: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) (where.created_at as any).gte = new Date(from_date);
      if (to_date) (where.created_at as any).lte = new Date(to_date);
    }

    const orderBy: Prisma.AlkesOrderByWithRelationInput = {};
    if (sort_by) {
      (orderBy as any)[sort_by] = order || 'desc';
    } else {
      orderBy.nama_alat = 'asc';
    }

    const [data, total] = await Promise.all([
      prisma.alkes.findMany({
        where,
        skip,
        take,
        select: {
          ...ALKES_SELECT,
          group: { select: { id: true, name: true, level: true } },
          creator: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy,
      }),
      prisma.alkes.count({ where }),
    ]);
    res.json({ success: true, data: paginatedResponse(data, total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = await getCache(CacheKeys.alkesDetail(req.params.id));
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const alkes = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      include: {
        group: { include: { parent: { include: { parent: true } } } },
        images: { orderBy: { urutan: 'asc' } },
      },
    });
    if (!alkes) throw new AppError(404, 'Alkes tidak ditemukan');

    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    if (staffRoomId) {
      // Check if alkes.group_id is equal to staffRoomId OR a child of it
      let isAllowed = alkes.group_id === staffRoomId;
      if (!isAllowed && alkes.group) {
        if (alkes.group.parent_id === staffRoomId) isAllowed = true;
        else if (alkes.group.parent?.parent_id === staffRoomId) isAllowed = true;
      }
      
      if (!isAllowed) {
        throw new AppError(403, 'Tidak memiliki akses ke data ruangan ini');
      }
    }

    await setCache(CacheKeys.alkesDetail(req.params.id), alkes, 600);
    res.json({ success: true, data: alkes });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = CreateAlkesSchema.parse(req.body);

    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    if (staffRoomId && body.group_id !== staffRoomId) {
      throw new AppError(403, 'Staff hanya boleh membuat alkes di ruangan yang ditugaskan');
    }

    // Status awal berdasarkan role: ADMIN → APPROVED (auto verified), lainnya → DRAFT
    const role = req.user?.role;
    const userId = req.user?.userId;
    const isAdmin = role === 'ADMIN';
    const createData: Prisma.AlkesUncheckedCreateInput = {
      ...body,
      created_by: userId,
      verification_status: isAdmin ? 'APPROVED' : 'DRAFT',
      verified_by: isAdmin ? (userId ?? null) : null,
      verified_at: isAdmin ? new Date() : null,
    } as Prisma.AlkesUncheckedCreateInput;

    const alkes = await prisma.alkes.create({ data: createData });
    await delCachePattern('alkes:list*');
    await delCache(CacheKeys.dashboardStats());

    if (userId) {
      logActivity({
        userId,
        action: 'CREATE',
        entity: 'alkes',
        entityId: alkes.id,
        description: `Alkes dibuat: ${alkes.nama_alat}`,
        req,
      });
      logVerification({
        entityType: 'alkes',
        entityId: alkes.id,
        fromStatus: 'NONE',
        toStatus: alkes.verification_status,
        actorId: userId,
        note: isAdmin ? 'Dibuat & di-approve langsung oleh admin' : 'Dibuat sebagai draft',
      });
    }

    res.status(201).json({ success: true, data: alkes });
  } catch (err) {
    next(err);
  }
}

// ─── Workflow: Submit / Approve / Reject ──────────────────────────────────────

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');

    const existing = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        nama_alat: true,
        group_id: true,
        created_by: true,
        verification_status: true,
      },
    });
    if (!existing) throw new AppError(404, 'Alkes tidak ditemukan');

    // Room scope untuk STAFF/MANAGER
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, assigned_room_id: true },
    });
    if (actor?.role === 'STAFF' || actor?.role === 'MANAGER') {
      if (!actor.assigned_room_id) {
        throw new AppError(403, 'Akun belum di-assign ke ruangan');
      }
      if (existing.group_id !== actor.assigned_room_id) {
        throw new AppError(403, 'Tidak boleh submit alkes di luar ruangan yang ditugaskan');
      }
    }

    if (!['DRAFT', 'REJECTED', 'REVISED'].includes(existing.verification_status)) {
      throw new AppError(
        400,
        `Alkes tidak dapat disubmit dari status ${existing.verification_status}`,
      );
    }

    const from = existing.verification_status;
    const next_status = from === 'REJECTED' ? 'REVISED' : 'PENDING';

    const updated = await prisma.alkes.update({
      where: { id: existing.id },
      data: {
        verification_status: next_status,
        submitted_at: new Date(),
        rejection_reason: null,
      },
    });

    await delCache(CacheKeys.alkesDetail(existing.id));

    logActivity({
      userId,
      action: 'SUBMIT',
      entity: 'alkes',
      entityId: existing.id,
      description: `Alkes "${existing.nama_alat}" disubmit untuk verifikasi`,
      req,
    });
    logVerification({
      entityType: 'alkes',
      entityId: existing.id,
      fromStatus: from,
      toStatus: next_status,
      actorId: userId,
    });
    notifyAdmins({
      title: 'Alkes menunggu verifikasi',
      message: `"${existing.nama_alat}" disubmit oleh pegawai.`,
      type: 'INFO',
      link: `/verifikasi/alkes/${existing.id}`,
    });
    broadcastVerificationEvent('alkes.verification.updated', {
      id: existing.id,
      verification_status: next_status,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');

    const existing = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        nama_alat: true,
        created_by: true,
        verification_status: true,
      },
    });
    if (!existing) throw new AppError(404, 'Alkes tidak ditemukan');

    if (!['PENDING', 'REVISED'].includes(existing.verification_status)) {
      throw new AppError(400, 'Alkes tidak berada pada status yang dapat di-approve');
    }

    const from = existing.verification_status;
    const updated = await prisma.alkes.update({
      where: { id: existing.id },
      data: {
        verification_status: 'APPROVED',
        verified_by: userId,
        verified_at: new Date(),
        rejection_reason: null,
      },
    });

    await delCache(
      CacheKeys.alkesDetail(existing.id),
      CacheKeys.alkesList(),
      CacheKeys.dashboardStats(),
    );

    logActivity({
      userId,
      action: 'APPROVE',
      entity: 'alkes',
      entityId: existing.id,
      description: `Alkes "${existing.nama_alat}" di-approve`,
      req,
    });
    logVerification({
      entityType: 'alkes',
      entityId: existing.id,
      fromStatus: from,
      toStatus: 'APPROVED',
      actorId: userId,
    });
    if (existing.created_by) {
      notifyUser({
        userId: existing.created_by,
        title: 'Alkes disetujui',
        message: `"${existing.nama_alat}" telah disetujui admin.`,
        type: 'SUCCESS',
        link: `/alkes/${existing.id}`,
      });
    }
    broadcastVerificationEvent('alkes.verification.updated', {
      id: existing.id,
      verification_status: 'APPROVED',
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');

    const { note } = RejectSchema.parse(req.body);

    const existing = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        nama_alat: true,
        created_by: true,
        verification_status: true,
      },
    });
    if (!existing) throw new AppError(404, 'Alkes tidak ditemukan');

    if (!['PENDING', 'REVISED'].includes(existing.verification_status)) {
      throw new AppError(400, 'Alkes tidak berada pada status yang dapat ditolak');
    }

    const from = existing.verification_status;
    const updated = await prisma.alkes.update({
      where: { id: existing.id },
      data: {
        verification_status: 'REJECTED',
        verified_by: userId,
        verified_at: new Date(),
        rejection_reason: note,
      },
    });

    await delCache(CacheKeys.alkesDetail(existing.id));

    logActivity({
      userId,
      action: 'REJECT',
      entity: 'alkes',
      entityId: existing.id,
      description: `Alkes "${existing.nama_alat}" ditolak`,
      metadata: { reason: note },
      req,
    });
    logVerification({
      entityType: 'alkes',
      entityId: existing.id,
      fromStatus: from,
      toStatus: 'REJECTED',
      actorId: userId,
      note,
    });
    if (existing.created_by) {
      notifyUser({
        userId: existing.created_by,
        title: 'Alkes ditolak',
        message: `"${existing.nama_alat}" ditolak: ${note}`,
        type: 'WARNING',
        link: `/alkes/${existing.id}`,
      });
    }
    broadcastVerificationEvent('alkes.verification.updated', {
      id: existing.id,
      verification_status: 'REJECTED',
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function bulkVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');

    const { alkes_ids, status, note } = req.body;
    if (!Array.isArray(alkes_ids) || alkes_ids.length === 0) {
      throw new AppError(400, 'alkes_ids harus berupa array dan tidak boleh kosong');
    }
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new AppError(400, 'Status verifikasi harus APPROVED atau REJECTED');
    }
    if (status === 'REJECTED' && !note) {
      throw new AppError(400, 'Catatan alasan wajib diisi jika status tidak sesuai (REJECTED)');
    }

    const items = await prisma.alkes.findMany({
      where: { id: { in: alkes_ids } },
      select: { id: true, nama_alat: true, verification_status: true, group_id: true },
    });

    if (items.length === 0) throw new AppError(404, 'Barang tidak ditemukan');

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, assigned_room_id: true },
    });

    // Authorization check for Staff/Manager (Optional: skipping complex hierarchy check for now, trusting the UI filtering)
    if (actor?.role === 'STAFF' || actor?.role === 'MANAGER') {
      if (!actor.assigned_room_id) throw new AppError(403, 'Akun belum di-assign ke ruangan');
    }

    const updated = await prisma.alkes.updateMany({
      where: { id: { in: alkes_ids } },
      data: {
        verification_status: status,
        verified_by: userId,
        verified_at: new Date(),
        verification_note: note || null,
        rejection_reason: note || null,
      },
    });

    for (const item of items) {
      logVerification({
        entityType: 'alkes',
        entityId: item.id,
        fromStatus: item.verification_status,
        toStatus: status,
        actorId: userId,
        note,
      });
      await delCache(CacheKeys.alkesDetail(item.id));
    }

    await delCachePattern('alkes:list*');
    await delCache(CacheKeys.dashboardStats());

    logActivity({
      userId,
      action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      entity: 'alkes',
      entityId: 'BULK',
      description: `Verifikasi massal ${alkes_ids.length} alkes menjadi ${status}`,
      metadata: { count: alkes_ids.length, status, note },
      req,
    });

    res.json({ success: true, message: `Berhasil memverifikasi ${updated.count} barang` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/alkes/:id/resolve
 * Admin "Terima Laporan & Sesuaikan Data" dari Staff.
 * Mengakui laporan discrepancy Staff sebagai valid → status menjadi APPROVED,
 * data sudah dikonfirmasi Admin, rejection_reason di-clear.
 */
export async function resolve(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError(401, 'Tidak terautentikasi');

    const existing = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      select: { id: true, nama_alat: true, verification_status: true, created_by: true },
    });
    if (!existing) throw new AppError(404, 'Alkes tidak ditemukan');
    if (existing.verification_status !== 'REJECTED') {
      throw new AppError(400, 'Hanya alkes dengan status REJECTED yang dapat diselesaikan');
    }

    const from = existing.verification_status;
    const updated = await prisma.alkes.update({
      where: { id: existing.id },
      data: {
        verification_status: 'APPROVED',
        verified_by: userId,
        verified_at: new Date(),
        rejection_reason: null,
        verification_note: null,
      },
    });

    await delCache(CacheKeys.alkesDetail(existing.id));
    await delCachePattern('alkes:list*');

    logActivity({
      userId,
      action: 'APPROVE',
      entity: 'alkes',
      entityId: existing.id,
      description: `Admin menyelesaikan laporan discrepancy dan menyetujui "${existing.nama_alat}"`,
      req,
    });
    logVerification({
      entityType: 'alkes',
      entityId: existing.id,
      fromStatus: from,
      toStatus: 'APPROVED',
      actorId: userId,
      note: 'Laporan ketidaksesuaian diterima Admin dan diselesaikan',
    });
    if (existing.created_by) {
      notifyUser({
        userId: existing.created_by,
        title: 'Laporan Diselesaikan',
        message: `Admin telah menyelesaikan laporan untuk "${existing.nama_alat}". Status: SESUAI.`,
        type: 'SUCCESS',
        link: `/alkes/${existing.id}`,
      });
    }
    broadcastVerificationEvent('alkes.verification.updated', {
      id: existing.id,
      verification_status: 'APPROVED',
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}



export async function verificationLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const alkesId = req.params.id;
    const exists = await prisma.alkes.findUnique({
      where: { id: alkesId },
      include: { group: { include: { parent: { include: { parent: true } } } } },
    });
    if (!exists) throw new AppError(404, 'Alkes tidak ditemukan');

    // Room scope untuk STAFF/MANAGER
    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    if (staffRoomId) {
      let isAllowed = exists.group_id === staffRoomId;
      if (!isAllowed && exists.group) {
        if (exists.group.parent_id === staffRoomId) isAllowed = true;
        else if (exists.group.parent?.parent_id === staffRoomId) isAllowed = true;
      }
      if (!isAllowed) {
        throw new AppError(403, 'Tidak memiliki akses ke data ruangan ini');
      }
    }

    const logs = await prisma.verificationLog.findMany({
      where: { entity_type: 'alkes', entity_id: alkesId },
      orderBy: { created_at: 'asc' },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function pendingCount(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.alkes.count({
      where: { verification_status: { in: ['PENDING', 'REVISED'] } },
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const body = UpdateAlkesSchema.parse(req.body);

    const existing = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      select: { id: true, group_id: true },
    });
    if (!existing) throw new AppError(404, 'Alkes tidak ditemukan');

    const actor = req.user?.userId
      ? await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { role: true, assigned_room_id: true },
        })
      : null;

    // Semua role (ADMIN/MANAGER/STAFF) boleh edit.
    // STAFF & MANAGER dibatasi hanya pada ruangan yang ditugaskan beserta sub-ruangannya.
    if (actor?.role === 'STAFF' || actor?.role === 'MANAGER') {
      const roomId = actor.assigned_room_id;
      if (!roomId) {
        const label = actor.role === 'MANAGER' ? 'manager' : 'staff';
        throw new AppError(403, `Akun ${label} belum di-assign ke ruangan`);
      }
      
      const allowedIds = [roomId];
      const children = await prisma.alkesGroup.findMany({
        where: { parent_id: roomId },
        select: { id: true },
      });
      if (children.length > 0) {
        const childIds = children.map(c => c.id);
        allowedIds.push(...childIds);
        const grandchildren = await prisma.alkesGroup.findMany({
          where: { parent_id: { in: childIds } },
          select: { id: true },
        });
        allowedIds.push(...grandchildren.map(c => c.id));
      }

      const currentGroupId = existing.group_id;
      const targetGroupId = body.group_id ?? existing.group_id;
      
      if (!currentGroupId || !allowedIds.includes(currentGroupId) || (targetGroupId && !allowedIds.includes(targetGroupId))) {
        const label = actor.role === 'MANAGER' ? 'Manager' : 'Staff';
        throw new AppError(
          403,
          `${label} hanya boleh memperbarui alkes di ruangan yang ditugaskan (termasuk sub-ruangan)`,
        );
      }
    }

    const updateData: Prisma.AlkesUncheckedUpdateInput = {
      ...(body as Prisma.AlkesUncheckedUpdateInput),
    };

    // STAFF/MANAGER edit langsung, tapi status menunggu konfirmasi admin
    if (actor?.role === 'STAFF' || actor?.role === 'MANAGER') {
      updateData.verification_status = 'PENDING';
      updateData.verified_by = null;
      updateData.verified_at = null;
    }

    // ADMIN edit dianggap terkonfirmasi
    if (actor?.role === 'ADMIN') {
      updateData.verification_status = 'APPROVED';
      updateData.verified_by = req.user?.userId ?? null;
      updateData.verified_at = new Date();
    }

    const alkes = await prisma.alkes
      .update({
        where: { id: req.params.id },
        data: updateData,
      })
      .catch((err) => handlePrismaError(err, 'Alkes'));

    await delCache(
      CacheKeys.alkesDetail(req.params.id),
      CacheKeys.alkesList(),
      CacheKeys.alkesRusak(),
      CacheKeys.dashboardStats(),
    );

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'UPDATE',
        entity: 'alkes',
        entityId: alkes.id,
        description: `Alkes diperbarui: ${alkes.nama_alat}`,
        metadata: { fields: Object.keys(body) },
        req,
      });
    }

    res.json({ success: true, data: alkes });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const alkes = await prisma.alkes.findUnique({
      where: { id: req.params.id },
      include: { images: true },
    });
    if (!alkes) throw new AppError(404, 'Alkes tidak ditemukan');

    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    if (staffRoomId && alkes.group_id !== staffRoomId) {
      throw new AppError(403, 'Staff hanya boleh menghapus alkes di ruangan yang ditugaskan');
    }

    // Hapus semua foto dari Cloudinary (jangan blokir jika gagal)
    if (alkes.images.length > 0) {
      await Promise.allSettled(alkes.images.map((img) => deleteFromCloudinary(img.public_id)));
    }

    await prisma.alkes.delete({ where: { id: req.params.id } });
    await delCache(
      CacheKeys.alkesDetail(req.params.id),
      CacheKeys.alkesList(),
      CacheKeys.alkesRusak(),
      CacheKeys.dashboardStats(),
    );

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'DELETE',
        entity: 'alkes',
        entityId: alkes.id,
        description: `Alkes dihapus: ${alkes.nama_alat}`,
        req,
      });
    }

    res.json({ success: true, message: 'Alkes berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function bulkDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const { alkes_ids } = req.body;
    if (!Array.isArray(alkes_ids) || alkes_ids.length === 0) {
      throw new AppError(400, 'alkes_ids harus berupa array dan tidak boleh kosong');
    }

    const items = await prisma.alkes.findMany({
      where: { id: { in: alkes_ids } },
      select: { id: true, group_id: true },
    });
    
    if (items.length === 0) {
      throw new AppError(404, 'Barang tidak ditemukan');
    }

    const staffRoomId = req.user?.userId ? await getStaffAssignedRoom(req.user.userId) : null;
    if (staffRoomId) {
      const outOfBounds = items.some(item => item.group_id !== staffRoomId);
      if (outOfBounds) {
        throw new AppError(403, 'Anda hanya boleh menghapus alkes di ruangan yang ditugaskan');
      }
    }

    const { count } = await prisma.alkes.deleteMany({
      where: { id: { in: alkes_ids } },
    });

    await delCachePattern('alkes:*');
    await delCachePattern('dashboard:*');

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'DELETE',
        entity: 'alkes',
        entityId: 'BULK',
        description: `${count} alkes dihapus secara massal`,
        req,
      });
    }

    res.json({ success: true, message: `${count} alkes berhasil dihapus` });
  } catch (err) {
    next(err);
  }
}

export async function getRusak(_req: Request, res: Response, next: NextFunction) {
  try {
    const where: Prisma.AlkesWhereInput = {
      berfungsi: { in: BERFUNGSI_RUSAK_VALUES },
    };

    const data = await prisma.alkes.findMany({
      where,
      select: { ...ALKES_SELECT, group: { select: { id: true, name: true } } },
      orderBy: { updated_at: 'desc' },
      take: 100,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function scan(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const alkes = await prisma.alkes.findFirst({
      where: {
        OR: [
          { no_seri: { equals: code, mode: 'insensitive' } },
          { kode_alat: { equals: code, mode: 'insensitive' } },
        ],
      },
      include: {
        images: { orderBy: { urutan: 'asc' } },
        group: { include: { parent: { include: { parent: true } } } },
      },
    });
    if (!alkes) throw new AppError(404, 'Alkes tidak ditemukan');

    // Build group path breadcrumb
    const group_path: string[] = [];
    if (alkes.group) {
      const g = alkes.group as typeof alkes.group & {
        parent?: { name: string; parent?: { name: string } } | null;
      };
      if (g.parent?.parent?.name) group_path.push(g.parent.parent.name);
      if (g.parent?.name) group_path.push(g.parent.name);
      group_path.push(g.name);
    }

    res.json({ success: true, data: { alkes, images: alkes.images, group_path } });
  } catch (err) {
    next(err);
  }
}

/**
 * Public endpoint (tanpa auth) untuk QR code scan.
 * Hanya mengembalikan data aman untuk ditampilkan ke publik.
 */
export async function publicScan(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const alkes = await prisma.alkes.findFirst({
      where: {
        verification_status: 'APPROVED',
        OR: [
          { kode_alat: { equals: code, mode: 'insensitive' } },
          { no_seri: { equals: code, mode: 'insensitive' } },
        ],
      },
      include: {
        images: {
          orderBy: { urutan: 'asc' },
          select: { id: true, url: true, is_primary: true, urutan: true },
        },
        group: { include: { parent: { include: { parent: true } } } },
      },
    });
    if (!alkes) throw new AppError(404, 'Alkes tidak ditemukan');

    const group_path: string[] = [];
    if (alkes.group) {
      const g = alkes.group as typeof alkes.group & {
        parent?: { name: string; parent?: { name: string } } | null;
      };
      if (g.parent?.parent?.name) group_path.push(g.parent.parent.name);
      if (g.parent?.name) group_path.push(g.parent.name);
      group_path.push(g.name);
    }

    const safe = {
      id: alkes.id,
      kode_alat: alkes.kode_alat,
      nama_alat: alkes.nama_alat,
      merk: alkes.merk,
      type: alkes.type,
      no_seri: alkes.no_seri,
      thn_pengadaan: alkes.thn_pengadaan,
      ada: alkes.ada,
      berfungsi: alkes.berfungsi,
      akl_akd: alkes.akl_akd,
      keterangan: alkes.keterangan,
      image_url: alkes.image_url,
      updated_at: alkes.updated_at,
      group: alkes.group ? { id: alkes.group.id, name: alkes.group.name } : null,
      images: alkes.images,
      group_path,
    };

    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
}
