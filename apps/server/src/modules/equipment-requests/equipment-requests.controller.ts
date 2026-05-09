import { type AlkesBerfungsi, Prisma } from '@prisma/client';
import { paginate, paginatedResponse } from '@repo/utils';
import {
  CreateEquipmentRequestSchema,
  FulfillRequestSchema,
  PaginationSchema,
  RejectSchema,
  RequestStatusEnum,
  RequestTypeEnum,
  UpdateEquipmentRequestSchema,
} from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logActivity } from '../../shared/utils/activityLogger.js';
import {
  broadcastVerificationEvent,
  logVerification,
  notifyAdmins,
  notifyUser,
} from '../../shared/utils/verificationLogger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRestrictedRoomId(userId: string): Promise<string | null> {
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

async function generateRequestNo(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `REQ-${yy}${mm}${dd}`;
  const count = await prisma.equipmentRequest.count({
    where: { request_no: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

function handlePrismaError(err: unknown, entity = 'Data'): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw new AppError(404, `${entity} tidak ditemukan`);
  }
  throw err;
}

const REQUEST_INCLUDE = {
  requester: { select: { id: true, name: true, email: true, role: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  group: { select: { id: true, name: true, level: true } },
  fulfilled_alkes: {
    select: { id: true, kode_alat: true, nama_alat: true, verification_status: true },
  },
} as const;

/** Map validator string ke Prisma enum `AlkesBerfungsi`. */
function mapBerfungsi(v: 'Baik' | 'Rusak' | 'tdk beroperasi' | 'tdk berfungsi'): AlkesBerfungsi {
  switch (v) {
    case 'Baik':
      return 'Baik' as AlkesBerfungsi;
    case 'Rusak':
      return 'Rusak' as AlkesBerfungsi;
    case 'tdk beroperasi':
      return 'tdk_beroperasi' as AlkesBerfungsi;
    case 'tdk berfungsi':
      return 'tdk_berfungsi' as AlkesBerfungsi;
  }
}

const EquipmentRequestQuerySchema = PaginationSchema.extend({
  status: RequestStatusEnum.optional(),
  type: RequestTypeEnum.optional(),
  group_id: z.string().uuid().optional(),
  mine: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  inventaris: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  sort_by: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
});

const ProcureRequestSchema = z.object({
  procurement_photo_url: z.string().refine(
    (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:'),
    { message: 'URL foto tidak valid atau bukan gambar Base64' }
  ),
  generate_qr: z.boolean().optional().default(true),
});

// ─── LIST ─────────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = EquipmentRequestQuerySchema.parse(req.query);
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true, assigned_room_id: true },
    });
    if (!user) throw new AppError(401, 'User tidak ditemukan');

    const where: Prisma.EquipmentRequestWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.group_id) where.group_id = q.group_id;
    if (q.q) {
      where.OR = [
        { nama_alat: { contains: q.q, mode: 'insensitive' } },
        { request_no: { contains: q.q, mode: 'insensitive' } },
        { justifikasi: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.mine) where.requested_by = req.user.userId;

    // Jika mode inventaris, tampilkan APPROVED/FULFILLED tanpa role filter
    if (q.inventaris) {
      where.status = { in: ['APPROVED', 'FULFILLED'] };
    } else {
      if (user.role === 'STAFF') {
        // STAFF melihat semua pengajuan pada ruangan yang di-assign (sesuai pola aset)
        if (!user.assigned_room_id) {
          throw new AppError(403, 'Akun staff belum di-assign ke ruangan');
        }
        where.group_id = user.assigned_room_id;
      } else if (user.role === 'MANAGER') {
        if (user.assigned_room_id) {
          // MANAGER melihat pengajuan pada ruangan yang di-assign + miliknya sendiri
          const extraOr = [{ group_id: user.assigned_room_id }, { requested_by: req.user.userId }];
          where.OR = where.OR ? [...where.OR, ...extraOr] : extraOr;
        } else {
          where.requested_by = req.user.userId;
        }
      }
    }

    if (q.from_date || q.to_date) {
      where.created_at = {};
      if (q.from_date) (where.created_at as any).gte = new Date(q.from_date);
      if (q.to_date) (where.created_at as any).lte = new Date(q.to_date);
    }

    const orderBy: any = q.sort_by ? { [q.sort_by]: q.order || 'desc' } : { created_at: 'desc' };

    const { skip, take } = paginate(q.page, q.limit);
    const [total, rows] = await Promise.all([
      prisma.equipmentRequest.count({ where }),
      prisma.equipmentRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy,
        skip,
        take,
      }),
    ]);

    res.json(paginatedResponse(rows, total, q.page, q.limit));
  } catch (err) {
    next(err);
  }
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');

    const { id } = req.params;
    const request = await prisma.equipmentRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!request) throw new AppError(404, 'Pengajuan tidak ditemukan');

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true, assigned_room_id: true },
    });
    if (!user) throw new AppError(401, 'User tidak ditemukan');

    if (user.role === 'STAFF' && request.requested_by !== req.user.userId) {
      throw new AppError(403, 'Anda tidak memiliki akses ke pengajuan ini');
    }
    if (user.role === 'MANAGER') {
      const isOwner = request.requested_by === req.user.userId;
      const isRoom = request.group_id && request.group_id === user.assigned_room_id;
      if (!isOwner && !isRoom) {
        throw new AppError(403, 'Anda tidak memiliki akses ke pengajuan ini');
      }
    }

    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const input = CreateEquipmentRequestSchema.parse(req.body);

    const roomId = await getRestrictedRoomId(req.user.userId);
    if (roomId && input.group_id && input.group_id !== roomId) {
      throw new AppError(403, 'Anda hanya bisa membuat pengajuan untuk ruangan yang di-assign');
    }
    const groupId = roomId ? roomId : (input.group_id ?? null);

    const request_no = await generateRequestNo();

    const created = await prisma.equipmentRequest.create({
      data: {
        request_no,
        requested_by: req.user.userId,
        type: input.type,
        status: 'DRAFT',
        nama_alat: input.nama_alat,
        group_id: groupId,
        merk: input.merk ?? null,
        type_alat: input.type_alat ?? null,
        quantity: input.quantity,
        estimated_price: input.estimated_price ?? null,
        pendanaan_usulan: input.pendanaan_usulan ?? null,
        justifikasi: input.justifikasi,
        spesifikasi: input.spesifikasi ?? null,
        attachment_url: input.attachment_url ?? null,
      },
      include: REQUEST_INCLUDE,
    });

    await logActivity({
      userId: req.user.userId,
      action: 'REQUEST_CREATE',
      entity: 'equipment_request',
      entityId: created.id,
      description: `Membuat pengajuan ${created.request_no} (${created.nama_alat})`,
      req,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

// ─── UPDATE (Draft Only) ──────────────────────────────────────────────────────

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;
    const input = UpdateEquipmentRequestSchema.parse(req.body);

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: { id: true, status: true, requested_by: true, request_no: true },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.requested_by !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Anda bukan pemilik pengajuan ini');
    }
    if (existing.status !== 'DRAFT') {
      throw new AppError(409, 'Pengajuan sudah tidak dalam status DRAFT');
    }

    const updated = await prisma.equipmentRequest.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.nama_alat !== undefined && { nama_alat: input.nama_alat }),
        ...(input.group_id !== undefined && { group_id: input.group_id }),
        ...(input.merk !== undefined && { merk: input.merk }),
        ...(input.type_alat !== undefined && { type_alat: input.type_alat }),
        ...(input.quantity !== undefined && { quantity: input.quantity }),
        ...(input.estimated_price !== undefined && { estimated_price: input.estimated_price }),
        ...(input.pendanaan_usulan !== undefined && { pendanaan_usulan: input.pendanaan_usulan }),
        ...(input.justifikasi !== undefined && { justifikasi: input.justifikasi }),
        ...(input.spesifikasi !== undefined && { spesifikasi: input.spesifikasi }),
        ...(input.attachment_url !== undefined && { attachment_url: input.attachment_url }),
      },
      include: REQUEST_INCLUDE,
    });

    await logActivity({
      userId: req.user.userId,
      action: 'UPDATE',
      entity: 'equipment_request',
      entityId: updated.id,
      description: `Memperbarui pengajuan ${updated.request_no}`,
      req,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    try {
      handlePrismaError(err, 'Pengajuan');
    } catch (wrapped) {
      next(wrapped);
    }
  }
}

// ─── SUBMIT (DRAFT/REJECTED → PENDING) ────────────────────────────────────────

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: { id: true, status: true, requested_by: true, request_no: true, nama_alat: true },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.requested_by !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Anda bukan pemilik pengajuan ini');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError(409, 'Hanya pengajuan DRAFT/REJECTED yang bisa dikirim');
    }

    const fromStatus = existing.status;
    const result = await prisma.equipmentRequest.updateMany({
      where: { id, status: { in: ['DRAFT', 'REJECTED'] } },
      data: { status: 'PENDING', submitted_at: new Date(), rejection_reason: null },
    });
    if (result.count === 0) throw new AppError(409, 'State berubah — silakan refresh');

    const updated = await prisma.equipmentRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'REQUEST_SUBMIT',
        entity: 'equipment_request',
        entityId: id,
        description: `Mengirim pengajuan ${existing.request_no} untuk ditinjau`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus,
        toStatus: 'PENDING',
        actorId: req.user.userId,
      }),
      notifyAdmins({
        title: 'Pengajuan Alat Baru',
        message: `${existing.request_no} — ${existing.nama_alat}`,
        type: 'INFO',
        link: `/pengajuan/${id}`,
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'PENDING' });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── APPROVE (ADMIN, PENDING → APPROVED) ──────────────────────────────────────

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: { id: true, status: true, request_no: true, nama_alat: true, requested_by: true },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.status !== 'PENDING') {
      throw new AppError(409, 'Hanya pengajuan PENDING yang bisa disetujui');
    }

    const result = await prisma.equipmentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewed_by: req.user.userId,
        reviewed_at: new Date(),
        rejection_reason: null,
      },
    });
    if (result.count === 0) throw new AppError(409, 'State berubah — silakan refresh');

    const updated = await prisma.equipmentRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'REQUEST_APPROVE',
        entity: 'equipment_request',
        entityId: id,
        description: `Menyetujui pengajuan ${existing.request_no}`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        actorId: req.user.userId,
      }),
      notifyUser({
        userId: existing.requested_by,
        title: 'Pengajuan Disetujui',
        message: `${existing.request_no} — ${existing.nama_alat} telah disetujui`,
        type: 'SUCCESS',
        link: `/pengajuan/${id}`,
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'APPROVED' });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── REJECT (ADMIN, PENDING → REJECTED) ───────────────────────────────────────

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;
    const { note } = RejectSchema.parse(req.body);

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: { id: true, status: true, request_no: true, nama_alat: true, requested_by: true },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.status !== 'PENDING') {
      throw new AppError(409, 'Hanya pengajuan PENDING yang bisa ditolak');
    }

    const result = await prisma.equipmentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewed_by: req.user.userId,
        reviewed_at: new Date(),
        rejection_reason: note,
      },
    });
    if (result.count === 0) throw new AppError(409, 'State berubah — silakan refresh');

    const updated = await prisma.equipmentRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'REQUEST_REJECT',
        entity: 'equipment_request',
        entityId: id,
        description: `Menolak pengajuan ${existing.request_no}: ${note.slice(0, 100)}`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus: 'PENDING',
        toStatus: 'REJECTED',
        actorId: req.user.userId,
        note,
      }),
      notifyUser({
        userId: existing.requested_by,
        title: 'Pengajuan Ditolak',
        message: `${existing.request_no} ditolak. Alasan: ${note.slice(0, 120)}`,
        type: 'WARNING',
        link: `/pengajuan/${id}`,
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'REJECTED' });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── CANCEL (Owner, DRAFT/PENDING → CANCELLED) ────────────────────────────────

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: { id: true, status: true, requested_by: true, request_no: true },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.requested_by !== req.user.userId && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Anda bukan pemilik pengajuan ini');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'PENDING') {
      throw new AppError(409, 'Hanya DRAFT/PENDING yang bisa dibatalkan');
    }

    const fromStatus = existing.status;
    const result = await prisma.equipmentRequest.updateMany({
      where: { id, status: { in: ['DRAFT', 'PENDING'] } },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) throw new AppError(409, 'State berubah — silakan refresh');

    const updated = await prisma.equipmentRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'UPDATE',
        entity: 'equipment_request',
        entityId: id,
        description: `Membatalkan pengajuan ${existing.request_no}`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus,
        toStatus: 'CANCELLED',
        actorId: req.user.userId,
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'CANCELLED' });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── FULFILL (ADMIN, APPROVED → FULFILLED + create Alkes) ─────────────────────

export async function procure(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const { id } = req.params;
    const input = ProcureRequestSchema.parse(req.body);

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        request_no: true,
        nama_alat: true,
        requested_by: true,
      },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.status !== 'APPROVED') {
      throw new AppError(409, 'Hanya pengajuan APPROVED yang bisa ditandai sudah dibelikan');
    }

    const qrCode = input.generate_qr ? existing.request_no : null;

    const updated = await prisma.equipmentRequest.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        procurement_photo_url: input.procurement_photo_url,
        qr_code: qrCode,
        fulfilled_at: new Date(),
        reviewed_by: req.user.userId,
        reviewed_at: new Date(),
      },
      include: REQUEST_INCLUDE,
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'REQUEST_FULFILL',
        entity: 'equipment_request',
        entityId: id,
        description: `Menandai pengajuan ${existing.request_no} sudah dibelikan`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus: 'APPROVED',
        toStatus: 'FULFILLED',
        actorId: req.user.userId,
        metadata: { procurement_photo_url: input.procurement_photo_url, qr_code: qrCode },
      }),
      notifyUser({
        userId: existing.requested_by,
        title: 'Pengajuan Sudah Dibelikan',
        message: `${existing.request_no} — ${existing.nama_alat} sudah dibelikan`,
        type: 'SUCCESS',
        link: '/inventaris',
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'FULFILLED' });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── FULFILL (ADMIN, APPROVED → FULFILLED + create Alkes) ─────────────────────

export async function fulfill(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Tidak terautentikasi');
    const userId = req.user.userId;
    const { id } = req.params;
    const input = FulfillRequestSchema.parse({ ...req.body, request_id: id });

    const existing = await prisma.equipmentRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        request_no: true,
        nama_alat: true,
        requested_by: true,
        fulfilled_alkes_id: true,
      },
    });
    if (!existing) throw new AppError(404, 'Pengajuan tidak ditemukan');
    if (existing.status !== 'APPROVED') {
      throw new AppError(409, 'Hanya pengajuan APPROVED yang bisa di-fulfill');
    }
    if (existing.fulfilled_alkes_id) {
      throw new AppError(409, 'Pengajuan sudah di-fulfill sebelumnya');
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingAlkes = await tx.alkes.findUnique({
        where: { kode_alat: input.kode_alat },
        select: { id: true },
      });
      if (existingAlkes) {
        throw new AppError(409, `Kode alat "${input.kode_alat}" sudah digunakan`);
      }

      const alkes = await tx.alkes.create({
        data: {
          group_id: input.group_id ?? null,
          mark: input.mark ?? '',
          kode_alat: input.kode_alat,
          nama_alat: input.nama_alat,
          ada: input.ada,
          no_seri: input.no_seri ?? null,
          merk: input.merk ?? null,
          type: input.type ?? null,
          thn_pengadaan: input.thn_pengadaan ?? null,
          berfungsi: mapBerfungsi(input.berfungsi),
          harga: input.harga ?? null,
          pendanaan: input.pendanaan ?? null,
          distributor: input.distributor ?? null,
          akl_akd: input.akl_akd ?? null,
          keterangan: input.keterangan ?? null,
          created_by: userId,
          verification_status: 'APPROVED',
          verified_by: userId,
          verified_at: new Date(),
        },
      });

      const request = await tx.equipmentRequest.update({
        where: { id },
        data: {
          status: 'FULFILLED',
          fulfilled_alkes_id: alkes.id,
          fulfilled_at: new Date(),
          reviewed_by: userId,
          reviewed_at: new Date(),
        },
        include: REQUEST_INCLUDE,
      });

      return { alkes, request };
    });

    await Promise.all([
      logActivity({
        userId: req.user.userId,
        action: 'REQUEST_FULFILL',
        entity: 'equipment_request',
        entityId: id,
        description: `Memenuhi pengajuan ${existing.request_no} → Alkes ${result.alkes.kode_alat}`,
        req,
      }),
      logVerification({
        entityType: 'equipment_request',
        entityId: id,
        fromStatus: 'APPROVED',
        toStatus: 'FULFILLED',
        actorId: req.user.userId,
        metadata: { alkes_id: result.alkes.id, kode_alat: result.alkes.kode_alat },
      }),
      notifyUser({
        userId: existing.requested_by,
        title: 'Pengajuan Dipenuhi',
        message: `${existing.request_no} telah dipenuhi dengan alat ${result.alkes.kode_alat}`,
        type: 'SUCCESS',
        link: `/pengajuan/${id}`,
      }),
    ]);
    broadcastVerificationEvent('request.updated', { id, status: 'FULFILLED' });

    res.json({ success: true, data: result.request });
  } catch (err) {
    next(err);
  }
}

// ─── PENDING COUNT ────────────────────────────────────────────────────────────

export async function pendingCount(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.equipmentRequest.count({ where: { status: 'PENDING' } });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

// ─── VERIFICATION LOGS ────────────────────────────────────────────────────────

export async function verificationLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const logs = await prisma.verificationLog.findMany({
      where: { entity_type: 'equipment_request', entity_id: id },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { created_at: 'asc' },
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}
