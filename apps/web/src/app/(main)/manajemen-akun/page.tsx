'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Search, ShieldAlert, Trash2, UserCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
  last_login_at?: string | null;
  assigned_room_id?: string | null;
  assigned_room?: { id: string; name: string; level: number } | null;
};

type RoomOption = {
  id: string;
  name: string;
  level: number;
};

type UsersListResp = {
  data: UserItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
  is_active: boolean;
  assigned_room_id: string | null;
};

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'STAFF',
  is_active: true,
  assigned_room_id: null,
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-[#003ec7] text-white border-transparent',
  MANAGER: 'bg-[#eff4ff] text-[#003ec7] border-[#c7d8ff]',
  STAFF: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

function getInitials(name?: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function extractErr(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null) {
    const anyE = e as {
      response?: { data?: { error?: string; message?: string } };
      message?: string;
    };
    return anyE.response?.data?.error || anyE.response?.data?.message || anyE.message || fallback;
  }
  return fallback;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
          <p className="mt-1 font-semibold text-2xl text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
          <UserCircle className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ManajemenAkunPage() {
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const [openDelete, setOpenDelete] = useState<UserItem | null>(null);
  const [openReset, setOpenReset] = useState<UserItem | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN';

  const { data, isLoading } = useQuery<UsersListResp>({
    queryKey: ['users', page, q, role, isActive],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (q) params.q = q;
      if (role) params.role = role;
      if (isActive) params.is_active = isActive;
      const r = await api.get('/users', { params });
      return r.data.data as UsersListResp;
    },
    enabled: isAdmin,
  });

  const { data: rooms = [] } = useQuery<RoomOption[]>({
    queryKey: ['room-options'],
    queryFn: async () => {
      const r = await api.get('/alkes/groups');
      const groups = (r.data.data ?? []) as RoomOption[];
      return groups;
    },
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: async (body: UserFormState) => {
      const payload: Record<string, unknown> = { ...body };
      if (body.role === 'ADMIN') payload.assigned_room_id = null;
      const r = await api.post('/users', payload);
      return r.data;
    },
    onSuccess: () => {
      toast.success('User berhasil dibuat');
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpenForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal membuat user')),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<UserFormState> }) => {
      const { password, ...rest } = body;
      const payload: Record<string, unknown> = { ...rest };
      if (password) payload.password = password;
      if (body.role === 'ADMIN') payload.assigned_room_id = null;
      const r = await api.patch(`/users/${id}`, payload);
      return r.data;
    },
    onSuccess: () => {
      toast.success('User berhasil diperbarui');
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpenForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal memperbarui user')),
  });

  const toggleMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await api.patch(`/users/${id}/toggle-active`);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => toast.error(extractErr(e, 'Gagal mengubah status user')),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await api.delete(`/users/${id}`);
      return r.data;
    },
    onSuccess: () => {
      toast.success('User dihapus');
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpenDelete(null);
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal menghapus user')),
  });

  const resetPwMut = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const r = await api.patch(`/users/${id}/reset-password`, { password });
      return r.data;
    },
    onSuccess: () => {
      toast.success('Password berhasil direset');
      setOpenReset(null);
      setResetPwd('');
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal reset password')),
  });

  const users = data?.data ?? [];
  const meta = data?.meta;

  const stats = useMemo(() => {
    const total = meta?.total ?? users.length;
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    return { total, active, admins };
  }, [users, meta]);

  if (!isAdmin) {
    return (
      <div>
        <div className="p-8">
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[#003ec7]" />
            <h3 className="mb-1 font-semibold text-lg text-slate-800">Akses Ditolak</h3>
            <p className="text-slate-500 text-sm">
              Halaman ini hanya dapat diakses oleh pengguna dengan role ADMIN.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const openCreateDialog = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpenForm(true);
  };

  const openEditDialog = (u: UserItem) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      is_active: u.is_active,
      assigned_room_id: u.assigned_room_id ?? null,
    });
    setOpenForm(true);
  };

  const submitForm = () => {
    if (!form.name || !form.email) {
      toast.error('Nama dan email wajib diisi');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password wajib diisi untuk user baru');
      return;
    }
    if (form.role !== 'ADMIN' && !form.assigned_room_id) {
      toast.error('Ruangan wajib dipilih untuk role selain Admin');
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, body: form });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">
              Daftar Akun Pengguna
            </h2>
            <p className="mt-1 text-slate-500 text-sm">
              Kelola akses, peran, dan status akun staf sistem inventaris Alkes.
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="h-10 gap-2 rounded-lg bg-[#003ec7] text-white hover:bg-[#0052ff]"
          >
            <Plus className="h-4 w-4" />
            Tambah User Baru
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total User" value={stats.total} accent="bg-[#eff4ff] text-[#003ec7]" />
          <StatCard label="Aktif" value={stats.active} accent="bg-emerald-50 text-emerald-700" />
          <StatCard label="Admin" value={stats.admins} accent="bg-amber-50 text-amber-700" />
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-md">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama atau email..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-10 pl-9"
              />
            </div>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as '' | Role);
                setPage(1);
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
            >
              <option value="">Semua Role</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
            </select>
            <select
              value={isActive}
              onChange={(e) => {
                setIsActive(e.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                setQ('');
                setRole('');
                setIsActive('');
                setPage(1);
              }}
              className="h-10"
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Pengguna</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Ruangan</th>
                  <th className="px-6 py-3 font-medium">Dibuat</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading &&
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-6 w-16" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-6 w-12" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="ml-auto h-8 w-24" />
                      </td>
                    </tr>
                  ))}

                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      <UserCircle className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      Tidak ada user yang cocok dengan filter.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  users.map((u) => (
                    <tr key={u.id} className="group transition-colors hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003ec7] font-medium text-white text-xs">
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{u.name}</div>
                            <div className="text-slate-500 text-xs">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={`rounded-md border px-2.5 py-0.5 font-medium text-xs ${ROLE_COLORS[u.role]}`}
                        >
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.role === 'ADMIN' ? '-' : (u.assigned_room?.name ?? '-')}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(u.created_at)}</td>
                      <td className="px-6 py-4">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={u.is_active}
                            disabled={u.id === currentUser?.id || toggleMut.isPending}
                            onChange={() => toggleMut.mutate(u.id)}
                          />
                          <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#003ec7] peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50" />
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEditDialog(u)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#003ec7]"
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenReset(u);
                              setResetPwd('');
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={u.id === currentUser?.id}
                            onClick={() => setOpenDelete(u)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Hapus user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 0 && (
            <div className="flex items-center justify-between border-slate-100 border-t bg-slate-50/40 px-6 py-3 text-sm">
              <span className="text-slate-500">
                Menampilkan{' '}
                <span className="font-medium text-slate-700">
                  {(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)}
                </span>{' '}
                dari <span className="font-medium text-slate-700">{meta.total}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <span className="px-2 text-slate-500 text-xs">
                  Hal. {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog (Create / Edit) */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Perbarui informasi akun pengguna di bawah.'
                : 'Buat akun baru untuk staf yang dapat mengakses sistem.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="contoh: Siti Rahayu"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contoh@medassist.id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password {editing && <span className="text-slate-400 text-xs">(opsional)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? 'Biarkan kosong untuk tidak mengubah' : 'Min. 6 karakter'}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            </div>
            {form.role !== 'ADMIN' && (
              <div className="space-y-1.5">
                <Label htmlFor="assigned_room_id">Ruangan</Label>
                <select
                  id="assigned_room_id"
                  value={form.assigned_room_id ?? ''}
                  onChange={(e) => setForm({ ...form, assigned_room_id: e.target.value || null })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
                >
                  <option value="">Pilih Ruangan</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button
              onClick={submitForm}
              disabled={createMut.isPending || updateMut.isPending}
              className="bg-[#003ec7] hover:bg-[#0052ff]"
            >
              {createMut.isPending || updateMut.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!openReset} onOpenChange={(o) => !o && setOpenReset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Tetapkan password baru untuk <span className="font-medium">{openReset?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="reset-pwd">Password Baru</Label>
            <Input
              id="reset-pwd"
              type="password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder="Min. 6 karakter"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button
              disabled={resetPwMut.isPending || resetPwd.length < 6}
              onClick={() =>
                openReset && resetPwMut.mutate({ id: openReset.id, password: resetPwd })
              }
              className="bg-amber-600 hover:bg-amber-700"
            >
              {resetPwMut.isPending ? 'Menyimpan...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!openDelete} onOpenChange={(o) => !o && setOpenDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus User?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus akun{' '}
              <span className="font-medium">{openDelete?.name}</span> secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button
              disabled={deleteMut.isPending}
              onClick={() => openDelete && deleteMut.mutate(openDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMut.isPending ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
