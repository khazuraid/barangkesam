import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'STAFF']);
export const AlkesAdaEnum = z.enum(['Ya', 'Tidak']);
export const AlkesBerfungsiEnum = z.enum(['Baik', 'Rusak', 'tdk beroperasi', 'tdk berfungsi']);
export const AlkesPendanaanEnum = z.enum(['APBN', 'APBD', 'Hibah', 'KSO', 'BLU', 'JKLN']);
export const VerificationStatusEnum = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVISED',
]);
export const RequestTypeEnum = z.enum(['NEW_EQUIPMENT', 'REPLACEMENT', 'ADDITIONAL']);
export const RequestStatusEnum = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'FULFILLED',
]);
export const LogActionEnum = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'IMPORT',
  'EXPORT',
  'UPLOAD',
  'TOGGLE_ACTIVE',
  'RESET_PASSWORD',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'REQUEST_CREATE',
  'REQUEST_SUBMIT',
  'REQUEST_APPROVE',
  'REQUEST_REJECT',
  'REQUEST_FULFILL',
]);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Password lama wajib diisi'),
    new_password: z.string().min(6, 'Password baru minimal 6 karakter'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  });

// ─── Users ───────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: UserRoleEnum,
  assigned_room_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: UserRoleEnum.optional(),
  assigned_room_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export const UsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  role: UserRoleEnum.optional(),
  is_active: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
});

// ─── Alkes Groups ─────────────────────────────────────────────────────────────

export const CreateAlkesGroupSchema = z.object({
  name: z.string().min(2, 'Nama kelompok wajib diisi').max(200),
  level: z.number().int().min(1).max(3),
  parent_id: z.string().uuid().optional().nullable(),
});

export const UpdateAlkesGroupSchema = z.object({
  name: z.string().min(2).max(200),
});

// ─── Alkes ───────────────────────────────────────────────────────────────────

export const CreateAlkesSchema = z.object({
  group_id: z.string().uuid().optional().nullable(),
  mark: z.string().max(20).optional().default(''),
  kode_alat: z.string().min(1, 'Kode alat wajib diisi').max(50),
  nama_alat: z.string().min(1, 'Nama alat wajib diisi').max(300),
  ada: AlkesAdaEnum.default('Tidak'),
  no_seri: z.string().max(100).optional().nullable(),
  merk: z.string().max(100).optional().nullable(),
  type: z.string().max(100).optional().nullable(),
  thn_pengadaan: z.number().int().min(1970).max(new Date().getFullYear()).optional().nullable(),
  berfungsi: AlkesBerfungsiEnum.default('Rusak'),
  harga: z.number().min(0).optional().nullable(),
  pendanaan: AlkesPendanaanEnum.optional().nullable(),
  distributor: z.string().max(200).optional().nullable(),
  akl_akd: z.string().max(100).optional().nullable(),
  keterangan: z.string().optional().nullable(),
});

export const UpdateAlkesSchema = CreateAlkesSchema.partial();

export const UpdateAlkesKondisiSchema = z.object({
  berfungsi: AlkesBerfungsiEnum,
  no_seri: z.string().max(100).optional().nullable(),
  keterangan: z.string().optional().nullable(),
});

export const SubmitAlkesSchema = z.object({
  action: z.enum(['SUBMIT']).default('SUBMIT'),
});

export const RejectSchema = z.object({
  note: z.string().min(10, 'Alasan penolakan minimal 10 karakter').max(500),
});

// ─── Alkes Images ─────────────────────────────────────────────────────────────

export const UpdateAlkesImageSchema = z.object({
  caption: z.string().max(200).optional().nullable(),
  is_primary: z.boolean().optional(),
});

export const ReorderAlkesImagesSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
});

// ─── Import ──────────────────────────────────────────────────────────────────

export const ImportAlkesSchema = z.object({
  group_id: z.string().uuid().optional().nullable(),
});

// ─── Equipment Requests ───────────────────────────────────────────────────────

export const CreateEquipmentRequestSchema = z.object({
  type: RequestTypeEnum,
  nama_alat: z.string().min(1, 'Nama alat wajib diisi').max(300),
  group_id: z.string().uuid().optional().nullable(),
  merk: z.string().max(100).optional().nullable(),
  type_alat: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(1, 'Jumlah minimal 1'),
  estimated_price: z.number().min(0).optional().nullable(),
  pendanaan_usulan: AlkesPendanaanEnum.optional().nullable(),
  justifikasi: z.string(),
  spesifikasi: z.string().optional().nullable(),
  attachment_url: z.string().url().optional().nullable(),
});

export const UpdateEquipmentRequestSchema = CreateEquipmentRequestSchema.partial();

export const FulfillRequestSchema = z.object({
  request_id: z.string().uuid('request_id harus UUID valid'),
  group_id: z.string().uuid().optional().nullable(),
  mark: z.string().max(20).optional().default(''),
  kode_alat: z.string().min(1, 'Kode alat wajib diisi').max(50),
  nama_alat: z.string().min(1, 'Nama alat wajib diisi').max(300),
  ada: AlkesAdaEnum.default('Ya'),
  no_seri: z.string().max(100).optional().nullable(),
  merk: z.string().max(100).optional().nullable(),
  type: z.string().max(100).optional().nullable(),
  thn_pengadaan: z.number().int().min(1970).max(new Date().getFullYear()).optional().nullable(),
  berfungsi: AlkesBerfungsiEnum.default('Baik'),
  harga: z.number().min(0).optional().nullable(),
  pendanaan: AlkesPendanaanEnum.optional().nullable(),
  distributor: z.string().max(200).optional().nullable(),
  akl_akd: z.string().max(100).optional().nullable(),
  keterangan: z.string().optional().nullable(),
});

// ─── Activity Logs ───────────────────────────────────────────────────────────

export const ActivityLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: LogActionEnum.optional(),
  entity: z.string().optional(),
  user_id: z.string().uuid().optional(),
  entity_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
});

// ─── Query Params ─────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

export const AlkesQuerySchema = PaginationSchema.extend({
  group_id: z.string().uuid().optional(),
  ada: AlkesAdaEnum.optional(),
  berfungsi: AlkesBerfungsiEnum.optional(),
  pendanaan: AlkesPendanaanEnum.optional(),
  verification_status: VerificationStatusEnum.optional(),
  mine: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  sort_by: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const ImportLogsQuerySchema = PaginationSchema.extend({});

export const NotificationsQuerySchema = PaginationSchema.extend({
  is_read: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateAlkesGroupInput = z.infer<typeof CreateAlkesGroupSchema>;
export type CreateAlkesInput = z.infer<typeof CreateAlkesSchema>;
export type UpdateAlkesInput = z.infer<typeof UpdateAlkesSchema>;
export type AlkesQueryInput = z.infer<typeof AlkesQuerySchema>;
export type UsersQueryInput = z.infer<typeof UsersQuerySchema>;
export type ActivityLogsQueryInput = z.infer<typeof ActivityLogsQuerySchema>;
export type SubmitAlkesInput = z.infer<typeof SubmitAlkesSchema>;
export type RejectInput = z.infer<typeof RejectSchema>;
export type CreateEquipmentRequestInput = z.infer<typeof CreateEquipmentRequestSchema>;
export type UpdateEquipmentRequestInput = z.infer<typeof UpdateEquipmentRequestSchema>;
export type FulfillRequestInput = z.infer<typeof FulfillRequestSchema>;

// Aliases (TODO/plan naming compatibility)
export const submitAlkesSchema = SubmitAlkesSchema;
export const rejectSchema = RejectSchema;
export const createRequestSchema = CreateEquipmentRequestSchema;
export const fulfillRequestSchema = FulfillRequestSchema;
