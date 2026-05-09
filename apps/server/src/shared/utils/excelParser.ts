import type { ImportErrorDetail } from '@repo/types';
import { parseDecimal, parseYear } from '@repo/utils';
import * as XLSX from 'xlsx';
import { BERFUNGSI_INPUT_MAP, type BerfungsiValue } from '../constants/enums.js';

const PENDANAAN_VALUES = ['APBN', 'APBD', 'Hibah', 'KSO', 'BLU', 'JKLN'] as const;

export interface ParsedAlkesRow {
  type: 'L1' | 'L2' | 'L3' | 'data' | 'end';
  name?: string;
  data?: {
    mark: string;
    kode_alat: string;
    nama_alat: string;
    ada: string;
    no_seri: string | null;
    merk: string | null;
    type: string | null;
    thn_pengadaan: number | null;
    berfungsi: BerfungsiValue;
    harga: number | null;
    pendanaan: string | null;
    distributor: string | null;
    akl_akd: string | null;
    keterangan: string | null;
  };
  error?: string;
  row?: number;
}

/**
 * Get cell value as a trimmed string from a SheetJS row array.
 * col is 1-based (col 1 = index 0).
 */
function cellStr(row: unknown[], col: number): string {
  const val = row[col - 1];
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizeAda(raw: string): 'Ya' | 'Tidak' | null {
  const t = raw.trim().toLowerCase();
  if (t === 'ya') return 'Ya';
  if (t === 'tidak') return 'Tidak';
  return null;
}

function normalizePendanaan(raw: string): string | null {
  const t = raw.trim();
  return PENDANAAN_VALUES.includes(t as (typeof PENDANAAN_VALUES)[number]) ? t : null;
}

export async function parseAlkesExcel(buffer: Buffer): Promise<{
  kode_: string;
  rows: ParsedAlkesRow[];
  errors: ImportErrorDetail[];
}> {
  // SheetJS reads both .xlsx (ZIP) and .xls (BIFF) automatically
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Sheet tidak ditemukan dalam file Excel');

  const sheet = workbook.Sheets[sheetName];

  // Convert to array-of-arrays (header: 1 means raw rows)
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,       // return raw row arrays
    defval: '',      // empty cells = empty string
    raw: false,      // all values as formatted strings
  }) as unknown[][];

  // Row 2 (index 1) col B (index 1) = kode_
  const kode_ = allRows[1]?.[1] != null ? String(allRows[1][1]).trim() : '';

  const rows: ParsedAlkesRow[] = [];
  const errors: ImportErrorDetail[] = [];

  // Data starts from row 5 (index 4)
  for (let i = 4; i < allRows.length; i++) {
    const row = allRows[i] ?? [];
    const rowNum = i + 1; // 1-based row number

    const mark = cellStr(row, 1);
    if (!mark) continue;

    if (mark.includes('::end::')) {
      rows.push({ type: 'end' });
      break;
    }

    if (mark === '*') {
      rows.push({ type: 'L1', name: cellStr(row, 2) });
    } else if (mark === '**') {
      rows.push({ type: 'L2', name: cellStr(row, 3) });
    } else if (mark === '***') {
      rows.push({ type: 'L3', name: cellStr(row, 4) });
    } else {
      const kode_alat = cellStr(row, 4);
      const nama_alat = cellStr(row, 5);
      const adaRaw = cellStr(row, 6);
      const berfungsiRaw = cellStr(row, 11);

      const rowErrors: string[] = [];
      if (!kode_alat) rowErrors.push('kode_alat wajib diisi');
      if (!nama_alat) rowErrors.push('nama_alat wajib diisi');

      const ada = normalizeAda(adaRaw);
      if (!ada) rowErrors.push(`nilai Ada "${adaRaw}" tidak valid (Ya/Tidak)`);

      const berfungsi = BERFUNGSI_INPUT_MAP[berfungsiRaw.trim()] ?? null;
      if (!berfungsi) rowErrors.push(`nilai Berfungsi "${berfungsiRaw}" tidak valid`);

      const pendanaanRaw = cellStr(row, 13);
      const pendanaan = pendanaanRaw ? normalizePendanaan(pendanaanRaw) : null;

      const thn = parseYear(cellStr(row, 10));

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, kode: kode_alat, nama: nama_alat, error: rowErrors.join('; ') });
        continue;
      }

      rows.push({
        type: 'data',
        row: rowNum,
        data: {
          mark,
          kode_alat,
          nama_alat,
          ada: ada as 'Ya' | 'Tidak',
          no_seri: cellStr(row, 7) || null,
          merk: cellStr(row, 8) || null,
          type: cellStr(row, 9) || null,
          thn_pengadaan: thn,
          berfungsi: berfungsi as BerfungsiValue,
          harga: parseDecimal(cellStr(row, 12)),
          pendanaan,
          distributor: cellStr(row, 14) || null,
          akl_akd: cellStr(row, 15) || null,
          keterangan: cellStr(row, 16) || null,
        },
      });
    }
  }

  return { kode_, rows, errors };
}
