// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export type AlkesAda = 'Ya' | 'Tidak';

export type AlkesBerfungsi = 'Baik' | 'Rusak' | 'tdk beroperasi' | 'tdk berfungsi';

export type AlkesPendanaan = 'APBN' | 'APBD' | 'Hibah' | 'KSO' | 'BLU' | 'JKLN';

export type ImportType = 'ALKES';

export type ImportStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAIL';

export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export type VerificationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED';

export type RequestType = 'NEW_EQUIPMENT' | 'REPLACEMENT' | 'ADDITIONAL';

export type RequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FULFILLED';

export type LogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORT'
  | 'EXPORT'
  | 'UPLOAD'
  | 'TOGGLE_ACTIVE'
  | 'RESET_PASSWORD'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CREATE'
  | 'REQUEST_SUBMIT'
  | 'REQUEST_APPROVE'
  | 'REQUEST_REJECT'
  | 'REQUEST_FULFILL';

// ─── Entities ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  assigned_room_id: string | null;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  assigned_room?: AlkesGroup | null;
}

export interface AlkesGroup {
  id: string;
  level: number;
  name: string;
  parent_id: string | null;
  created_at: Date;
  children?: AlkesGroup[];
  _count?: { alkes: number };
}

export interface Alkes {
  id: string;
  group_id: string | null;
  mark: string;
  kode_alat: string;
  nama_alat: string;
  ada: AlkesAda;
  no_seri: string | null;
  merk: string | null;
  type: string | null;
  thn_pengadaan: number | null;
  berfungsi: AlkesBerfungsi;
  harga: number | null;
  pendanaan: AlkesPendanaan | null;
  distributor: string | null;
  akl_akd: string | null;
  keterangan: string | null;
  image_url: string | null;
  created_by: string;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: Date | null;
  rejection_reason: string | null;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  group?: AlkesGroup;
  images?: AlkesImage[];
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
  created_at: Date;
}

export interface ImportLog {
  id: string;
  type: ImportType;
  filename: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  error_detail: ImportErrorDetail[];
  status: ImportStatus;
  created_by: string;
  created_at: Date;
  creator?: User;
}

export interface ImportErrorDetail {
  row: number;
  kode?: string;
  nama?: string;
  error: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  created_at: Date;
}

export interface EquipmentRequest {
  id: string;
  request_no: string;
  requested_by: string;
  type: RequestType;
  status: RequestStatus;
  nama_alat: string;
  group_id: string | null;
  merk: string | null;
  type_alat: string | null;
  quantity: number;
  estimated_price: number | null;
  pendanaan_usulan: AlkesPendanaan | null;
  justifikasi: string;
  spesifikasi: string | null;
  attachment_url: string | null;
  submitted_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  fulfilled_alkes_id: string | null;
  fulfilled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  requester?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
  reviewer?: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
  group?: AlkesGroup | null;
}

export interface VerificationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  from_status: string;
  to_status: string;
  actor_id: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  actor?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: LogAction;
  entity: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  user?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportResult {
  log_id: string;
  total: number;
  success: number;
  failed: number;
  errors: ImportErrorDetail[];
}

// ─── Socket.IO Event Payloads ─────────────────────────────────────────────────

export interface ImportProgressPayload {
  log_id: string;
  processed: number;
  total: number;
  pct: number;
}

export interface ImportCompletedPayload {
  log_id: string;
  success: number;
  failed: number;
  errors: ImportErrorDetail[];
}

export interface AlkesUpdatedPayload {
  id: string;
  berfungsi: AlkesBerfungsi;
}

export interface NotificationNewPayload {
  id: string;
  title: string;
  type: NotificationType;
  link: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_alkes: number;
  alkes_baik: number;
  alkes_rusak: number;
  alkes_tdk_berfungsi: number;
  alkes_tdk_beroperasi: number;
  alkes_tidak_ada: number;
  total_nilai_alkes: number;
}

export interface DashboardChartItem {
  group: string;
  baik: number;
  rusak: number;
  tdk_berfungsi: number;
}

// ─── Scan Result ─────────────────────────────────────────────────────────────

export interface ScanResult {
  alkes: Alkes;
  images: AlkesImage[];
  group_path: string[];
}
