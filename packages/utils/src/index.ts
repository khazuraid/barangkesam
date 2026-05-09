// ─── Pagination ──────────────────────────────────────────────────────────────

export function paginate(page: number, limit: number) {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

export function successResponse<T>(data: T, message?: string) {
  return { success: true, data, message };
}

export function errorResponse(error: string, message?: string) {
  return { success: false, error, message };
}

// ─── String helpers ───────────────────────────────────────────────────────────

export function normalizeEnum<T extends string>(value: string, validValues: T[]): T | null {
  const trimmed = value.trim();
  const found = validValues.find((v) => v.toLowerCase() === trimmed.toLowerCase());
  return found ?? null;
}

export function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const str = String(value).trim();
  // Format Indonesia: 1.500.000,50 → hapus titik ribuan, ganti koma desimal ke titik
  // Format internasional: 1,500,000.50 → hapus koma ribuan
  // Deteksi: jika ada koma setelah titik terakhir → format Indonesia
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  let normalized: string;
  if (lastComma > lastDot) {
    // Format Indonesia: titik = ribuan, koma = desimal
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else {
    // Format internasional: koma = ribuan, titik = desimal
    normalized = str.replace(/,/g, '');
  }
  const num = Number(normalized);
  return Number.isNaN(num) ? null : num;
}

export function parseYear(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number.parseInt(String(value), 10);
  if (Number.isNaN(num) || num < 1970 || num > new Date().getFullYear()) return null;
  return num;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

export function buildCloudinaryFolder(alkesId: string): string {
  return `alkes/${alkesId}`;
}
