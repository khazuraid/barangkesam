// Tipe data API response untuk digunakan di komponen web

export type VerificationStatusValue = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED';

export interface AlkesItem {
  id: string;
  code: string;
  group_id: string | null;
  mark: string;
  kode_alat: string;
  nama_alat: string;
  ada: 'Ya' | 'Tidak';
  no_seri: string | null;
  merk: string | null;
  type: string | null;
  thn_pengadaan: number | null;
  berfungsi: string;
  harga: number | null;
  pendanaan: string | null;
  distributor: string | null;
  akl_akd: string | null;
  keterangan: string | null;
  image_url: string | null;
  created_by?: string;
  verification_status?: VerificationStatusValue;
  verified_by?: string | null;
  verified_at?: string | null;
  submitted_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  group?: { id: string; name: string; level: number } | null;
  images?: AlkesImage[];
  faskes?: { nama: string };
  creator?: { id: string; name: string; email: string; role?: string } | null;
  verifier?: { id: string; name: string; email: string } | null;
}

export interface AlkesImage {
  id: string;
  alkes_id: string;
  url: string;
  public_id: string;
  caption: string | null;
  is_primary: boolean;
  urutan: number;
  uploaded_by: string;
  created_at: string;
}

export interface PrasaranaItem {
  id: string;
  code: string;
  group_id: string | null;
  mark: string;
  nama_prasarana: string;
  jumlah: number | null;
  satuan: string | null;
  kondisi: string;
  keterangan: string | null;
  created_at: string;
  updated_at: string;
  group?: { id: string; name: string; level: number } | null;
}

export interface Item {
  id: string;
  kode_rs: string;
  nama: string;
  alamat: string | null;
}

export interface ImportError {
  row: number;
  kode?: string;
  nama?: string;
  error: string;
}

export interface ImportResult {
  log_id: string;
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

export interface DashboardStats {
  total_alkes: number;
  alkes_baik: number;
  alkes_rusak: number;
  alkes_tdk_berfungsi: number;
  alkes_tdk_beroperasi: number;
  alkes_tidak_ada: number;
  total_prasarana: number;
  prasarana_baik: number;
  prasarana_rusak: number;
  total_nilai_alkes: number;
}

export interface ChartItem {
  group: string;
  baik: number;
  rusak: number;
  tdk_berfungsi: number;
}
