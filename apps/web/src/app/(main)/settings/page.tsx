'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Lock,
  Mail,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

type MeResponse = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
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
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return 'Belum pernah login';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function computeStrength(pwd: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  if (!pwd) return { score: 0, label: '—', color: 'bg-slate-200' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  const s = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const table = [
    { label: '—', color: 'bg-slate-200' },
    { label: 'Sangat Lemah', color: 'bg-red-500' },
    { label: 'Lemah', color: 'bg-orange-500' },
    { label: 'Cukup', color: 'bg-amber-500' },
    { label: 'Kuat', color: 'bg-emerald-500' },
  ];
  return { score: s, label: table[s].label, color: table[s].color };
}

function HeroBanner({ user, loading }: { user?: MeResponse; loading?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#c7d8ff]/60 bg-gradient-to-br from-[#003ec7] via-[#0052ff] to-[#2563eb] shadow-[0_20px_40px_-12px_rgba(0,62,199,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
      <div className="-top-20 -right-20 pointer-events-none absolute h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="-bottom-24 -left-16 pointer-events-none absolute h-48 w-48 rounded-full bg-[#6ffbbe]/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:gap-8">
        {loading ? (
          <Skeleton className="h-24 w-24 shrink-0 rounded-2xl bg-white/20" />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white/40 bg-white/10 font-bold text-3xl text-white shadow-lg backdrop-blur-md">
            {getInitials(user?.name)}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Pengaturan Akun
          </div>
          {loading ? (
            <>
              <Skeleton className="h-7 w-48 bg-white/20" />
              <Skeleton className="h-4 w-72 bg-white/20" />
            </>
          ) : (
            <>
              <h1 className="truncate font-semibold text-2xl text-white tracking-tight md:text-3xl">
                {user?.name ?? '—'}
              </h1>
              <p className="truncate text-white/80 text-sm">{user?.email ?? '—'}</p>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {user?.role && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 font-medium text-white text-xs backdrop-blur">
                <UserCircle2 className="h-3.5 w-3.5" />
                {ROLE_LABEL[user.role]}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 py-1 font-medium text-emerald-50 text-xs backdrop-blur">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {user?.is_active ? 'Akun Aktif' : 'Nonaktif'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 font-medium text-white/90 text-xs backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" />
              Bergabung {formatDate(user?.created_at)}
            </span>
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md md:w-64">
          <p className="text-white/70 text-xs uppercase tracking-wider">Login Terakhir</p>
          <p className="mt-1 font-medium text-sm text-white">
            {formatDateTime(user?.last_login_at)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-white/80 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Dilindungi Argon2
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  iconTint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  iconTint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-8px_rgba(0,62,199,0.08)]">
      <div className="flex items-center gap-4 border-slate-100 border-b bg-gradient-to-r from-[#f8f9ff] to-transparent px-6 py-5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTint}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-slate-900">{title}</h3>
          <p className="truncate text-slate-500 text-xs">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  setShow,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  setShow: (v: boolean) => void;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-slate-700 text-sm">
        {label}
      </Label>
      <div className="relative">
        <Lock className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border-slate-200 bg-slate-50/70 pr-10 pl-9 text-sm focus:border-[#003ec7] focus:bg-white focus:ring-2 focus:ring-[#003ec7]/15"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="-translate-y-1/2 absolute top-1/2 right-3 text-slate-400 hover:text-slate-700"
          tabIndex={-1}
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const authUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: me, isLoading: loadingMe } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: async () => {
      const r = await api.get('/auth/me');
      return r.data.data as MeResponse;
    },
  });

  const [name, setName] = useState('');
  useEffect(() => {
    if (me?.name) setName(me.name);
  }, [me?.name]);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => computeStrength(newPwd), [newPwd]);
  const mismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;

  const updateProfileMut = useMutation({
    mutationFn: async (body: { name: string }) => {
      const r = await api.patch('/auth/me', body);
      return r.data.data as MeResponse;
    },
    onSuccess: (u) => {
      toast.success('Profil berhasil diperbarui');
      qc.invalidateQueries({ queryKey: ['me'] });
      useAuthStore.setState((state) =>
        state.user ? { user: { ...state.user, name: u.name } } : {},
      );
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal memperbarui profil')),
  });

  const changePwdMut = useMutation({
    mutationFn: async (body: {
      current_password: string;
      new_password: string;
      confirm_password: string;
    }) => {
      const r = await api.patch('/auth/change-password', body);
      return r.data;
    },
    onSuccess: () => {
      toast.success('Password berhasil diubah');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    },
    onError: (e) => toast.error(extractErr(e, 'Gagal mengubah password')),
  });

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter');
      return;
    }
    updateProfileMut.mutate({ name: name.trim() });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPwd) {
      toast.error('Password saat ini wajib diisi');
      return;
    }
    if (newPwd.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    changePwdMut.mutate({
      current_password: currentPwd,
      new_password: newPwd,
      confirm_password: confirmPwd,
    });
  };

  const user = me ?? (authUser as unknown as MeResponse | undefined);

  return (
    <div>
      <div className="space-y-6 px-4 sm:px-6 py-6">
        <HeroBanner user={user} loading={loadingMe} />

        <SectionCard
          icon={UserCircle2}
          title="Informasi Profil"
          subtitle="Perbarui data pribadi akun Anda."
          iconTint="bg-[#eff4ff] text-[#003ec7]"
        >
          <form onSubmit={submitProfile}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name" className="text-slate-700 text-sm">
                  Nama Lengkap
                </Label>
                {loadingMe ? (
                  <Skeleton className="h-11 w-full rounded-xl" />
                ) : (
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/70 text-sm focus:border-[#003ec7] focus:bg-white focus:ring-2 focus:ring-[#003ec7]/15"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700 text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    disabled
                    className="h-11 rounded-xl border-slate-200 bg-slate-100 pl-9 text-slate-500 text-sm"
                  />
                </div>
                <p className="flex items-center gap-1 text-slate-400 text-xs">
                  <Info className="h-3 w-3" />
                  Email tidak dapat diubah.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-slate-700 text-sm">
                  Role Pengguna
                </Label>
                <div className="relative">
                  <ShieldCheck className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="role"
                    value={user?.role ? ROLE_LABEL[user.role] : ''}
                    readOnly
                    disabled
                    className="h-11 rounded-xl border-slate-200 bg-slate-100 pl-9 text-slate-500 text-sm"
                  />
                </div>
                <p className="text-slate-400 text-xs">Hubungi admin untuk perubahan role.</p>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3 border-slate-100 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5"
                disabled={updateProfileMut.isPending || loadingMe}
                onClick={() => setName(me?.name ?? '')}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Batal
              </Button>
              <Button
                type="submit"
                disabled={
                  updateProfileMut.isPending || loadingMe || name.trim() === (me?.name ?? '')
                }
                className="h-11 rounded-xl bg-[#003ec7] px-5 text-white shadow-[0_8px_20px_-6px_rgba(0,62,199,0.5)] hover:bg-[#0052ff]"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMut.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          icon={KeyRound}
          title="Ganti Password"
          subtitle="Gunakan password yang kuat dan unik untuk keamanan akun."
          iconTint="bg-amber-50 text-amber-600"
        >
          <form onSubmit={submitPassword}>
            <div className="space-y-5">
              <PasswordField
                id="current-pwd"
                label="Password Saat Ini"
                value={currentPwd}
                onChange={setCurrentPwd}
                placeholder="Masukkan password Anda saat ini"
                show={showCurrent}
                setShow={setShowCurrent}
              />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <PasswordField
                    id="new-pwd"
                    label="Password Baru"
                    value={newPwd}
                    onChange={setNewPwd}
                    placeholder="Minimal 6 karakter"
                    show={showNew}
                    setShow={setShowNew}
                  />
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strength.score ? strength.color : 'bg-slate-100'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-slate-500 text-xs">
                      Kekuatan: <span className="font-medium text-slate-700">{strength.label}</span>
                    </p>
                  </div>
                </div>

                <PasswordField
                  id="confirm-pwd"
                  label="Konfirmasi Password Baru"
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  placeholder="Ulangi password baru"
                  show={showConfirm}
                  setShow={setShowConfirm}
                  error={mismatch ? 'Password tidak cocok' : null}
                />
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4">
                <div className="-top-8 -right-8 pointer-events-none absolute h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 font-semibold text-emerald-900 text-sm">
                      Tips Password Kuat
                    </p>
                    <ul className="grid gap-1 text-emerald-800/80 text-xs sm:grid-cols-2">
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        Gunakan min. 10 karakter
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        Kombinasi huruf, angka, simbol
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        Hindari data pribadi
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        Jangan pakai ulang di situs lain
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3 border-slate-100 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5"
                disabled={changePwdMut.isPending}
                onClick={() => {
                  setCurrentPwd('');
                  setNewPwd('');
                  setConfirmPwd('');
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={
                  changePwdMut.isPending ||
                  !currentPwd ||
                  newPwd.length < 6 ||
                  newPwd !== confirmPwd
                }
                className="h-11 rounded-xl bg-amber-600 px-5 text-white shadow-[0_8px_20px_-6px_rgba(217,119,6,0.45)] hover:bg-amber-700"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {changePwdMut.isPending ? 'Menyimpan...' : 'Perbarui Password'}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
