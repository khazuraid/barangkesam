import ExcelJS from 'exceljs';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { BERFUNGSI_DISPLAY_MAP } from '../../shared/constants/enums.js';
import { logActivity } from '../../shared/utils/activityLogger.js';

/** Konversi nilai internal Prisma (underscore) ke label tampilan Excel */
function displayBerfungsi(val: string): string {
  return BERFUNGSI_DISPLAY_MAP[val] ?? val.replace(/_/g, ' ');
}

function writeAlkesRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  a: {
    mark: string;
    kode_alat: string;
    nama_alat: string;
    ada: string;
    no_seri: string | null;
    merk: string | null;
    type: string | null;
    thn_pengadaan: number | null;
    berfungsi: string;
    harga: unknown;
    pendanaan: string | null;
    distributor: string | null;
    akl_akd: string | null;
    keterangan: string | null;
  },
): void {
  sheet.getRow(rowNum).values = [
    a.mark,
    '',
    '',
    a.kode_alat,
    a.nama_alat,
    a.ada,
    a.no_seri ?? 'xxx',
    a.merk ?? '-unknown-',
    a.type ?? '-unknown-',
    a.thn_pengadaan ?? '',
    displayBerfungsi(a.berfungsi),
    Number(a.harga ?? 0),
    a.pendanaan ?? '',
    a.distributor ?? '-',
    a.akl_akd ?? '',
    a.keterangan ?? '-',
  ];
}

export async function exportAlkes(req: Request, res: Response, next: NextFunction) {
  try {
    const group_id = req.query.group_id as string | undefined;

    let selectedGroup: { id: string; name: string; level: number } | null = null;
    if (group_id) {
      selectedGroup = await prisma.alkesGroup.findUnique({
        where: { id: group_id },
        select: { id: true, name: true, level: true },
      });
      if (!selectedGroup) throw new AppError(404, 'Kelompok tidak ditemukan');
    }

    const groups = await prisma.alkesGroup.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    const alkes = await prisma.alkes.findMany({
      where: group_id ? { group_id } : {},
      include: { group: true },
      orderBy: { nama_alat: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Format Import Alkes.xls');

    sheet.getRow(1).values = [
      'Format Import Alat Kesehatan',
      '',
      '',
      '',
      '',
      selectedGroup?.name ?? 'Semua Kelompok',
    ];
    sheet.getRow(2).values = ['Kode Kelompok', selectedGroup?.id ?? '-'];
    sheet.getCell('B2').font = { color: { argb: 'FFFF0000' }, bold: true };
    sheet.getRow(3).values = ['Form', 'f3'];
    sheet.getCell('B3').font = { color: { argb: 'FFFF0000' }, bold: true };
    sheet.getRow(4).values = [];
    sheet.getRow(5).values = [
      'mark',
      'Keterangan',
      '',
      '',
      '',
      'Ada',
      'No seri',
      'Merk',
      'Type',
      'Thn Pengadaan',
      'Berfungi',
      'Harga',
      'Pendanaan',
      'Distributor',
      'AKL/AKD',
      'Keterangan',
    ];
    sheet.getRow(5).font = { bold: true };
    sheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    let rowNum = 6;

    if (group_id) {
      for (const a of alkes) {
        writeAlkesRow(sheet, rowNum++, a);
      }
    } else {
      const l1Groups = groups.filter((g) => g.level === 1);
      for (const l1 of l1Groups) {
        sheet.getRow(rowNum++).values = ['*', l1.name];
        const l2Groups = groups.filter((g) => g.parent_id === l1.id);
        for (const l2 of l2Groups) {
          sheet.getRow(rowNum++).values = ['**', '', l2.name];
          const l3Groups = groups.filter((g) => g.parent_id === l2.id);
          for (const l3 of l3Groups) {
            sheet.getRow(rowNum++).values = ['***', '', '', l3.name];
            for (const a of alkes.filter((x) => x.group_id === l3.id)) {
              writeAlkesRow(sheet, rowNum++, a);
            }
          }
          for (const a of alkes.filter((x) => x.group_id === l2.id)) {
            writeAlkesRow(sheet, rowNum++, a);
          }
        }
        for (const a of alkes.filter((x) => x.group_id === l1.id)) {
          writeAlkesRow(sheet, rowNum++, a);
        }
      }

      const alkesNoGroup = alkes.filter((a) => !a.group_id);
      if (alkesNoGroup.length > 0) {
        sheet.getRow(rowNum++).values = ['*', 'Lainnya (Tanpa Kelompok)'];
        for (const a of alkesNoGroup) {
          writeAlkesRow(sheet, rowNum++, a);
        }
      }
    }

    sheet.getRow(rowNum).values = ['::end::'];

    // Sheet Petunjuk
    const petunjuk = workbook.addWorksheet('Petunjuk');
    petunjuk.getRow(1).values = ['', 'Peraturan'];
    const petunjukData: [number, string][] = [
      [1, 'Jangan menghapus/mengubah tanda ::end::'],
      [2, 'Jangan Mengubah format file import'],
      [3, 'Mengubah Template kode RS dan kode form yang berwarna merah'],
      [4, 'Kode RS adalah kode Rumah sakit/puskesmas yang dituju'],
      [5, 'Kode Form adalah kode jenis data yang akan diimport'],
      [6, 'kolom mark adalah penanda kode yang digunakan program sebagai panduan import'],
      [7, 'kode pada mark adalah kode data alat kesehatan'],
      [8, 'kode alat adalah kode alat dari daftar alat'],
      [
        9,
        'untuk penambahan data baru jika baris tidak mencukupi atau baris baru, sisipkan data menurut pola yang ada',
      ],
      [10, 'Data alat diterima jika kolom no seri terisi dan kolom "ada" terisi'],
    ];
    for (const [i, [num, text]] of petunjukData.entries()) {
      petunjuk.getRow(i + 2).values = [num, text];
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Format_Import_Alkes_${selectedGroup?.id ?? 'all'}.xlsx"`,
    );

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'EXPORT',
        entity: 'alkes',
        entityId: selectedGroup?.id,
        description: `Export alkes untuk ${selectedGroup?.name ?? 'semua kelompok'}`,
        metadata: { total_alkes: alkes.length, group_id: selectedGroup?.id ?? null },
        req,
      });
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
