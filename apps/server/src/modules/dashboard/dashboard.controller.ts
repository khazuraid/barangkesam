import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { CacheKeys, getCache, setCache } from '../../config/redis.js';
import { BERFUNGSI } from '../../shared/constants/enums.js';

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    const cacheKey = CacheKeys.dashboardStats();
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const [
      total_alkes,
      alkes_baik,
      alkes_rusak,
      alkes_tdk_berfungsi,
      alkes_tdk_beroperasi,
      alkes_tidak_ada,
      nilaiResult,
    ] = await Promise.all([
      prisma.alkes.count(),
      prisma.alkes.count({ where: { berfungsi: BERFUNGSI.BAIK } }),
      prisma.alkes.count({ where: { berfungsi: BERFUNGSI.RUSAK } }),
      prisma.alkes.count({ where: { berfungsi: BERFUNGSI.TDK_BERFUNGSI } }),
      prisma.alkes.count({ where: { berfungsi: BERFUNGSI.TDK_BEROPERASI } }),
      prisma.alkes.count({ where: { ada: 'Tidak' } }),
      prisma.alkes.aggregate({ _sum: { harga: true } }),
    ]);

    const data = {
      total_alkes,
      alkes_baik,
      alkes_rusak,
      alkes_tdk_berfungsi,
      alkes_tdk_beroperasi,
      alkes_tidak_ada,
      total_nilai_alkes: Number(nilaiResult._sum.harga ?? 0),
    };

    await setCache(cacheKey, data, 300);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function chart(_req: Request, res: Response, next: NextFunction) {
  try {
    const cacheKey = CacheKeys.dashboardChart();
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const allGroups = await prisma.alkesGroup.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    const allAlkes = await prisma.alkes.findMany({
      select: { berfungsi: true, group_id: true },
    });

    const groupMap = new Map(allGroups.map((g) => [g.id, g]));

    function getL1Id(groupId: string | null): string | null {
      if (!groupId) return null;
      const group = groupMap.get(groupId);
      if (!group) return null;
      if (group.level === 1) return group.id;
      if (group.parent_id) return getL1Id(group.parent_id);
      return null;
    }

    const l1Groups = allGroups.filter((g) => g.level === 1);
    const countMap = new Map<string, { baik: number; rusak: number; tdk_berfungsi: number }>();
    for (const g of l1Groups) {
      countMap.set(g.id, { baik: 0, rusak: 0, tdk_berfungsi: 0 });
    }

    for (const a of allAlkes) {
      const l1Id = getL1Id(a.group_id);
      if (!l1Id) continue;
      const counts = countMap.get(l1Id);
      if (!counts) continue;
      if (a.berfungsi === BERFUNGSI.BAIK) counts.baik++;
      else if (a.berfungsi === BERFUNGSI.RUSAK) counts.rusak++;
      else counts.tdk_berfungsi++;
    }

    const data = l1Groups.map((g) => ({
      group: g.name,
      ...(countMap.get(g.id) ?? { baik: 0, rusak: 0, tdk_berfungsi: 0 }),
    }));

    await setCache(cacheKey, data, 300);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function chartPengajuan(_req: Request, res: Response, next: NextFunction) {
  try {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const requests = await prisma.equipmentRequest.findMany({
      where: {
        created_at: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        created_at: true,
        status: true,
      },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const resultMap = new Map<string, { bulan: string; diajukan: number; dibeli: number; order: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      resultMap.set(key, {
        bulan: months[d.getMonth()],
        diajukan: 0,
        dibeli: 0,
        order: d.getTime(),
      });
    }

    for (const req of requests) {
      const key = `${req.created_at.getFullYear()}-${req.created_at.getMonth()}`;
      const group = resultMap.get(key);
      if (group) {
        // "diajukan" ignores DRAFT or CANCELLED, or we can just count all submitted requests
        if (req.status !== 'DRAFT' && req.status !== 'CANCELLED') {
          group.diajukan++;
        }
        if (req.status === 'FULFILLED') {
          group.dibeli++;
        }
      }
    }

    const data = Array.from(resultMap.values())
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        bulan: item.bulan,
        diajukan: item.diajukan,
        dibeli: item.dibeli,
      }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function perhatian(_req: Request, res: Response, next: NextFunction) {
  try {
    let groupFilter = {};
    if (_req.user?.role === 'STAFF' || _req.user?.role === 'MANAGER') {
      const user = await prisma.user.findUnique({
        where: { id: _req.user.userId },
        select: { assigned_room_id: true },
      });
      const staffRoomId = user?.assigned_room_id;
      if (staffRoomId) {
        const allowedIds = [staffRoomId];
        const children = await prisma.alkesGroup.findMany({
          where: { parent_id: staffRoomId },
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
        groupFilter = { group_id: { in: allowedIds } };
      } else {
        // If they have no room assigned, return empty dashboard lists
        return res.json({ success: true, data: [] });
      }
    }

    const [pengajuanPending, verifikasiPending, alkesRusak] = await Promise.all([
      prisma.equipmentRequest.findMany({
        where: { status: 'PENDING', ...groupFilter },
        orderBy: { created_at: 'desc' },
        take: 3,
        select: { id: true, request_no: true, nama_alat: true, created_at: true },
      }),
      prisma.alkes.findMany({
        where: { verification_status: 'PENDING', ...groupFilter },
        orderBy: { created_at: 'desc' },
        take: 3,
        select: { id: true, nama_alat: true, created_at: true },
      }),
      prisma.alkes.findMany({
        where: { 
          berfungsi: { in: [BERFUNGSI.RUSAK, BERFUNGSI.TDK_BERFUNGSI, BERFUNGSI.TDK_BEROPERASI] },
          ...groupFilter 
        },
        orderBy: { updated_at: 'desc' },
        take: 3,
        select: { id: true, nama_alat: true, berfungsi: true, updated_at: true },
      }),
    ]);

    const items: Array<{
      id: string;
      type: string;
      title: string;
      desc: string;
      date: Date;
      link: string;
    }> = [];

    for (const p of pengajuanPending) {
      items.push({
        id: p.id,
        type: 'pengajuan_pending',
        title: 'Pengajuan Menunggu Review',
        desc: `Pengajuan ${p.request_no} untuk ${p.nama_alat} menunggu persetujuan.`,
        date: p.created_at,
        link: `/pengajuan/${p.id}`,
      });
    }

    for (const v of verifikasiPending) {
      items.push({
        id: v.id,
        type: 'verifikasi_pending',
        title: 'Menunggu Verifikasi',
        desc: `Alat ${v.nama_alat} membutuhkan verifikasi data import.`,
        date: v.created_at,
        link: `/verifikasi/alkes?highlight=${v.id}`,
      });
    }

    for (const a of alkesRusak) {
      items.push({
        id: a.id,
        type: 'alkes_rusak',
        title: 'Laporan Kerusakan',
        desc: `${a.nama_alat} dilaporkan dalam kondisi ${a.berfungsi}.`,
        date: a.updated_at,
        link: `/alkes/${a.id}`,
      });
    }

    items.sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json({ success: true, data: items.slice(0, 5) });
  } catch (err) {
    next(err);
  }
}
