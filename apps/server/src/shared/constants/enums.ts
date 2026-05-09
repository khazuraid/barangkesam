/**
 * Konstanta enum yang konsisten dengan Prisma schema.
 *
 * Prisma menggunakan nama internal (underscore) untuk enum dengan @map:
 *   AlkesBerfungsi.tdk_beroperasi  @map("tdk beroperasi")
 *   AlkesBerfungsi.tdk_berfungsi   @map("tdk berfungsi")
 *
 * Gunakan konstanta ini di semua query Prisma dan logika bisnis.
 * Untuk output ke Excel/API response, gunakan BERFUNGSI_DISPLAY_MAP.
 */

// ─── AlkesBerfungsi (nilai internal Prisma) ───────────────────────────────────
export const BERFUNGSI = {
  BAIK: 'Baik',
  RUSAK: 'Rusak',
  TDK_BEROPERASI: 'tdk_beroperasi',
  TDK_BERFUNGSI: 'tdk_berfungsi',
} as const;

export type BerfungsiValue = (typeof BERFUNGSI)[keyof typeof BERFUNGSI];

/** Nilai yang diterima dari Excel/API input → nilai internal Prisma */
export const BERFUNGSI_INPUT_MAP: Record<string, BerfungsiValue> = {
  Baik: 'Baik',
  baik: 'Baik',
  Rusak: 'Rusak',
  rusak: 'Rusak',
  'tdk beroperasi': 'tdk_beroperasi',
  'Tdk Beroperasi': 'tdk_beroperasi',
  'tdk berfungsi': 'tdk_berfungsi',
  'Tdk Berfungsi': 'tdk_berfungsi',
  tdk_beroperasi: 'tdk_beroperasi',
  tdk_berfungsi: 'tdk_berfungsi',
};

/** Nilai internal Prisma → label tampilan (untuk Excel export & API response) */
export const BERFUNGSI_DISPLAY_MAP: Record<string, string> = {
  Baik: 'Baik',
  Rusak: 'Rusak',
  tdk_beroperasi: 'tdk beroperasi',
  tdk_berfungsi: 'tdk berfungsi',
};

/** Semua nilai internal Prisma yang dianggap "tidak berfungsi/rusak" */
export const BERFUNGSI_RUSAK_VALUES: BerfungsiValue[] = [
  'Rusak',
  'tdk_beroperasi',
  'tdk_berfungsi',
];
