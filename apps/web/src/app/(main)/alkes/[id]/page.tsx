'use client';

import { Badge } from '@/components/ui/badge';
import { buildAlkesScanUrl, isPublicUrlLocalhost } from '@/lib/publicUrl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RejectDialog } from '@/components/verification/RejectDialog';
import {
  type VerificationStatus as VStatus,
  VerificationBadge,
} from '@/components/verification/VerificationBadge';
import { VerificationTimeline } from '@/components/verification/VerificationTimeline';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { AlkesImage, AlkesItem, VerificationStatusValue } from '@/types/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  History,
  Info,
  Landmark,
  Package,
  Pencil,
  QrCode,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ApiError = {
  response?: { data?: { error?: string; details?: Record<string, string[]> } };
};
type AlkesDetail = AlkesItem & {
  creator?: { id: string; name: string; email: string };
  verification_status?: VerificationStatusValue | null;
};
interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: { id: string; name: string; email: string; role: string };
}
interface EditForm {
  nama_alat: string;
  merk: string;
  type: string;
  no_seri: string;
  mark: string;
  thn_pengadaan: string;
  harga: string;
  pendanaan: string;
  distributor: string;
  akl_akd: string;
  ada: 'Ya' | 'Tidak';
  berfungsi: 'Baik' | 'Rusak' | 'tdk beroperasi' | 'tdk berfungsi';
  keterangan: string;
}

const PENDANAAN = ['APBN', 'APBD', 'Hibah', 'KSO', 'BLU', 'JKLN'] as const;
const BERFUNGSI_STYLE: Record<string, string> = {
  Baik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rusak: 'bg-rose-50 text-rose-700 border-rose-200',
  'tdk beroperasi': 'bg-amber-50 text-amber-700 border-amber-200',
  'tdk berfungsi': 'bg-slate-100 text-slate-700 border-slate-300',
};
const KONDISI: { value: EditForm['berfungsi']; label: string }[] = [
  { value: 'Baik', label: 'Baik' },
  { value: 'Rusak', label: 'Rusak' },
  { value: 'tdk beroperasi', label: 'Tdk Beroperasi' },
  { value: 'tdk berfungsi', label: 'Tdk Berfungsi' },
];
const FIELD_LABELS: Record<string, string> = {
  nama_alat: 'Nama Alat',
  kode_alat: 'Kode Alat',
  merk: 'Merk',
  type: 'Type/Model',
  no_seri: 'No. Seri',
  mark: 'Mark',
  thn_pengadaan: 'Tahun Pengadaan',
  harga: 'Harga',
  pendanaan: 'Sumber Pendanaan',
  distributor: 'Distributor',
  akl_akd: 'No. AKL/AKD',
  ada: 'Ketersediaan',
  berfungsi: 'Kondisi',
  keterangan: 'Keterangan',
  group_id: 'Kelompok',
  faskes_id: 'Faskes',
  verification_status: 'Status Verifikasi',
};
const ACTION_STYLE: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  CREATE: {
    label: 'Dibuat',
    bg: 'bg-emerald-50 border border-emerald-100',
    text: 'text-emerald-700',
    icon: '✨',
  },
  UPDATE: {
    label: 'Diperbarui',
    bg: 'bg-indigo-50 border border-indigo-100',
    text: 'text-indigo-700',
    icon: '✏️',
  },
  DELETE: {
    label: 'Dihapus',
    bg: 'bg-rose-50 border border-rose-100',
    text: 'text-rose-700',
    icon: '🗑️',
  },
  UPLOAD: {
    label: 'Upload Foto',
    bg: 'bg-purple-50 border border-purple-100',
    text: 'text-purple-700',
    icon: '📷',
  },
  SUBMIT: {
    label: 'Diajukan',
    bg: 'bg-amber-50 border border-amber-100',
    text: 'text-amber-700',
    icon: '📤',
  },
  APPROVE: {
    label: 'Disetujui',
    bg: 'bg-emerald-50 border border-emerald-100',
    text: 'text-emerald-700',
    icon: '✅',
  },
  REJECT: {
    label: 'Ditolak',
    bg: 'bg-rose-50 border border-rose-100',
    text: 'text-rose-700',
    icon: '❌',
  },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '-';
  }
}
function formatRupiah(n: number | null | undefined): string {
  if (n == null) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}
function formatValue(field: string, val: unknown): string {
  if (val == null || val === '') return '—';
  if (field === 'harga' && typeof val === 'number') return formatRupiah(val);
  return String(val);
}

interface Change {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}
function extractChanges(metadata: Record<string, unknown> | null): Change[] {
  if (!metadata) return [];
  const out: Change[] = [];
  if (Array.isArray(metadata.changes)) {
    for (const c of metadata.changes as Array<{
      field?: string;
      before?: unknown;
      after?: unknown;
    }>) {
      if (c?.field)
        out.push({
          field: c.field,
          label: FIELD_LABELS[c.field] ?? c.field,
          before: c.before,
          after: c.after,
        });
    }
    return out;
  }
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  if (before && after) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (before[k] !== after[k])
        out.push({
          field: k,
          label: FIELD_LABELS[k] ?? k,
          before: before[k],
          after: after[k],
        });
    }
  }
  return out;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  const v = value == null || value === '' ? '—' : String(value);
  return (
    <div className="py-2">
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd
        className={`mt-1 text-base text-slate-900 ${mono ? 'font-mono text-sm tracking-tight' : ''} ${v === '—' ? 'text-slate-400 italic' : 'font-medium'}`}
      >
        {v}
      </dd>
    </div>
  );
}

export default function AlkesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const id = (params?.id as string) ?? '';
  const isAdmin = user?.role === 'ADMIN';
  const isManagerOrStaff = user?.role === 'MANAGER' || user?.role === 'STAFF';

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [form, setForm] = useState<EditForm | null>(null);

  // Photo upload in edit form
  const [editPhotos, setEditPhotos] = useState<File[]>([]);
  const [editPhotoPreviews, setEditPhotoPreviews] = useState<string[]>([]);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // QR code
  const [qrWarnLocal, setQrWarnLocal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  // Cleanup edit photo previews
  useEffect(() => {
    return () => { for (const u of editPhotoPreviews) URL.revokeObjectURL(u); };
  }, []);

  const { data: alkes, isLoading } = useQuery<AlkesDetail>({
    queryKey: ['alkes-detail', id],
    queryFn: () => api.get(`/alkes/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (alkes?.kode_alat) {
      setQrUrl(buildAlkesScanUrl(alkes.kode_alat));
      setQrWarnLocal(isPublicUrlLocalhost());
    }
  }, [alkes?.kode_alat]);

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['activity-logs-alkes', id],
    queryFn: () =>
      api
        .get('/activity-logs', { params: { entity: 'alkes', entity_id: id, limit: 50 } })
        .then((r) => r.data.data),
    enabled: !!id,
  });

  const logs: ActivityLog[] = useMemo(() => {
    const raw = logsData?.data ?? [];
    return raw.filter((l: ActivityLog) => l.entity_id === id);
  }, [logsData, id]);

  useEffect(() => {
    if (editOpen && alkes) {
      setForm({
        nama_alat: alkes.nama_alat ?? '',
        merk: alkes.merk ?? '',
        type: alkes.type ?? '',
        no_seri: alkes.no_seri ?? '',
        mark: alkes.mark ?? '',
        thn_pengadaan: alkes.thn_pengadaan?.toString() ?? '',
        harga: alkes.harga?.toString() ?? '',
        pendanaan: alkes.pendanaan ?? '',
        distributor: alkes.distributor ?? '',
        akl_akd: alkes.akl_akd ?? '',
        ada: (alkes.ada as 'Ya' | 'Tidak') ?? 'Tidak',
        berfungsi: (alkes.berfungsi as EditForm['berfungsi']) ?? 'Baik',
        keterangan: alkes.keterangan ?? '',
      });
    }
  }, [editOpen, alkes]);

  const handleEditPhotoAdd = (files: FileList | null) => {
    if (!files || !files.length) return;
    const valid = Array.from(files).filter((f) => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} bukan gambar`); return false; }
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} lebih dari 5MB`); return false; }
      return true;
    }).slice(0, 10 - editPhotos.length);
    setEditPhotos((p) => [...p, ...valid]);
    setEditPhotoPreviews((p) => [...p, ...valid.map((f) => URL.createObjectURL(f))]);
  };

  const handleEditPhotoRemove = (i: number) => {
    URL.revokeObjectURL(editPhotoPreviews[i]);
    setEditPhotos((p) => p.filter((_, j) => j !== i));
    setEditPhotoPreviews((p) => p.filter((_, j) => j !== i));
  };

  const handleDownloadQr = async () => {
    if (!alkes?.kode_alat || !qrUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });
      const link = document.createElement('a');
      link.download = `qrcode-${alkes.kode_alat}.png`;
      link.href = dataUrl;
      link.click();
    } catch { toast.error('Gagal download QR code'); }
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Form kosong');
      const payload: Record<string, unknown> = {
        nama_alat: form.nama_alat.trim(),
        ada: form.ada,
        berfungsi: form.berfungsi,
        merk: form.merk.trim() || null,
        type: form.type.trim() || null,
        no_seri: form.no_seri.trim() || null,
        mark: form.mark.trim() || null,
        thn_pengadaan: form.thn_pengadaan ? Number(form.thn_pengadaan) || null : null,
        harga: form.harga ? Number(form.harga) || null : null,
        pendanaan: form.pendanaan || null,
        distributor: form.distributor.trim() || null,
        akl_akd: form.akl_akd.trim() || null,
        keterangan: form.keterangan.trim() || null,
      };
      const updated = await api.patch(`/alkes/${id}`, payload).then((r) => r.data.data);

      // Upload new photos if any
      if (editPhotos.length > 0) {
        const fd = new FormData();
        for (const p of editPhotos) fd.append('files', p);
        await api.post(`/alkes/${id}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch(() => toast.warning('Data tersimpan, tapi upload foto gagal. Coba upload ulang.'));
      }
      return updated;
    },
    onSuccess: () => {
      toast.success('Alkes berhasil diperbarui');
      setEditOpen(false);
      setEditPhotos([]);
      setEditPhotoPreviews([]);
      qc.invalidateQueries({ queryKey: ['alkes-detail', id] });
      qc.invalidateQueries({ queryKey: ['activity-logs-alkes', id] });
      qc.invalidateQueries({ queryKey: ['alkes'] });
    },
    onError: (e: ApiError) => {
      const details = e.response?.data?.details;
      if (details) {
        const entries = Object.entries(details).filter(
          ([, msgs]) => Array.isArray(msgs) && msgs.length > 0,
        );
        if (entries.length > 0) {
          toast.error(
            `Validasi gagal:\n${entries.map(([f, m]) => `• ${f}: ${m.join(', ')}`).join('\n')}`,
            { duration: 7000 },
          );
          return;
        }
      }
      toast.error(e.response?.data?.error ?? 'Gagal memperbarui alkes');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/alkes/${id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Alkes berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['alkes'] });
      router.push('/alkes');
    },
    onError: (e: ApiError) => {
      toast.error(e.response?.data?.error ?? 'Gagal menghapus alkes');
    },
  });

  const invalidateAfterVerifyAction = () => {
    qc.invalidateQueries({ queryKey: ['alkes-detail', id] });
    qc.invalidateQueries({ queryKey: ['alkes', id, 'verification-logs'] });
    qc.invalidateQueries({ queryKey: ['alkes'] });
    qc.invalidateQueries({ queryKey: ['verifikasi', 'alkes'] });
  };

  const submitMut = useMutation({
    mutationFn: () => api.post(`/alkes/${id}/submit`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Data dikirim untuk verifikasi');
      invalidateAfterVerifyAction();
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Gagal submit'),
  });

  const approveMut = useMutation({
    mutationFn: () => api.post(`/alkes/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Alkes disetujui');
      invalidateAfterVerifyAction();
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Gagal approve'),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => api.post(`/alkes/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Alkes ditolak. Pegawai dapat merevisi.');
      setRejectOpen(false);
      invalidateAfterVerifyAction();
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Gagal menolak'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <div className="animate-pulse max-w-7xl mx-auto space-y-6">
          <div className="h-12 w-1/3 bg-slate-200 rounded-lg" />
          <div className="h-[400px] bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!alkes) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6 flex items-center justify-center">
        <div className="text-center py-20">
          <p className="text-slate-500 font-medium">Alat kesehatan tidak ditemukan</p>
          <Link
            href="/alkes"
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm mt-4 inline-block"
          >
            ← Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const images: AlkesImage[] = alkes.images ?? [];
  const primaryImage =
    images.find((i) => i.is_primary)?.url ?? images[0]?.url ?? alkes.image_url ?? null;
  const activeImage = images[photoIndex]?.url ?? primaryImage;
  const kondisiClass = BERFUNGSI_STYLE[alkes.berfungsi] ?? BERFUNGSI_STYLE.Baik;
  const sectionCls =
    'bg-white border border-slate-200/60 rounded-3xl p-7 shadow-sm transition-shadow hover:shadow-md';

  // Gate edit/hapus berdasarkan ruangan untuk MANAGER & STAFF.
  const userRoomId = user?.assigned_room_id ?? null;
  let isInAssignedRoom = true;
  if (isManagerOrStaff) {
    if (!userRoomId) {
      isInAssignedRoom = false;
    } else {
      let allowed = alkes.group_id === userRoomId;
      if (!allowed && alkes.group) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = alkes.group as any;
        if (g.parent_id === userRoomId) allowed = true;
        else if (g.parent?.parent_id === userRoomId) allowed = true;
      }
      isInAssignedRoom = allowed;
    }
  }

  const canEdit = isAdmin || (isManagerOrStaff && isInAssignedRoom);
  const canDelete = isAdmin;
  const outOfRoomMsg = isManagerOrStaff
    ? !userRoomId
      ? 'Akun Anda belum di-assign ke ruangan. Hubungi Admin.'
      : !isInAssignedRoom
        ? 'Anda hanya boleh mengedit alkes di ruangan yang ditugaskan (termasuk sub-ruangan).'
        : ''
    : '';

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200/60 pt-5 pb-4 px-4 sm:px-6 shadow-sm sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href="/alkes"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Daftar
            </Link>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 truncate">
                {alkes.nama_alat}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border ${kondisiClass}`}
              >
                {alkes.berfungsi}
              </span>
              <Badge
                variant={alkes.ada === 'Ya' ? 'default' : 'secondary'}
                className="px-3 py-1 shadow-sm"
              >
                {alkes.ada === 'Ya' ? '✓ Tersedia' : '✕ Tidak Tersedia'}
              </Badge>
              {alkes.verification_status && (
                <VerificationBadge status={alkes.verification_status as VStatus} />
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              SN: <span className="font-mono text-slate-700">{alkes.no_seri || '-'}</span> • Kode:{' '}
              <span className="font-mono text-slate-700">{alkes.kode_alat}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60">
            {isManagerOrStaff &&
              isInAssignedRoom &&
              (alkes.verification_status === 'DRAFT' ||
                alkes.verification_status === 'REJECTED') && (
                <Button
                  onClick={() => submitMut.mutate()}
                  disabled={submitMut.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-2 rounded-xl shadow-md"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {submitMut.isPending ? 'Mengirim…' : 'Ajukan Verifikasi'}
                </Button>
              )}

            {(isAdmin || (isManagerOrStaff && isInAssignedRoom)) &&
              (alkes.verification_status === 'PENDING' ||
                alkes.verification_status === 'REVISED') && (
                <>
                  <Button
                    onClick={() => approveMut.mutate()}
                    disabled={approveMut.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {approveMut.isPending ? 'Memproses…' : 'Sesuai (Verifikasi)'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 gap-2 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                    Tidak Sesuai
                  </Button>
                </>
              )}

            {canEdit && (
              <Button
                onClick={() => setEditOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-xl shadow-md"
              >
                <Pencil className="w-4 h-4" />
                Edit Data
              </Button>
            )}
            {!canEdit && isManagerOrStaff && (
              <span
                className="inline-flex items-center h-10 px-3 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200"
                title={outOfRoomMsg}
              >
                {outOfRoomMsg}
              </span>
            )}
            {canDelete && (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-6">
        {/* Banner REJECTED */}
        {alkes.verification_status === 'REJECTED' && alkes.rejection_reason && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-rose-100 p-2 rounded-full text-rose-600 mt-0.5">
              <X className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-rose-900 text-base">
                Ketidaksesuaian Data (Discrepancy)
              </p>
              <p className="mt-1 text-sm font-medium text-rose-700 whitespace-pre-wrap">
                "{alkes.rejection_reason}"
              </p>
              {isAdmin && (
                <p className="mt-3 text-xs font-semibold text-rose-800 bg-rose-100/50 inline-block px-3 py-1.5 rounded-lg border border-rose-200/50">
                  Silakan perbarui data melalui tombol "Edit Data" dan sistem akan otomatis
                  mengonfirmasi perbaikannya.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          {/* LEFT COLUMN */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            {/* Gallery */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Galeri Aset</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {images.length} foto tersedia
                  </p>
                </div>
              </div>

              {activeImage ? (
                <div className="space-y-4">
                  <div className="aspect-[16/10] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeImage ?? ''}
                      alt={alkes.nama_alat}
                      className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {images.map((img, idx) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setPhotoIndex(idx)}
                          className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${idx === photoIndex ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-sm' : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[16/10] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
                  <p className="text-sm font-medium">Belum ada dokumentasi foto</p>
                </div>
              )}
            </section>

            {/* Info Grid */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Spesifikasi Alat</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Identitas dan detail fungsional
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <DetailRow label="Kode Alat" value={alkes.kode_alat} mono />
                <DetailRow label="Nama Alat" value={alkes.nama_alat} />
                <DetailRow label="Merk" value={alkes.merk} />
                <DetailRow label="Type / Model" value={alkes.type} />
                <DetailRow label="No. Seri" value={alkes.no_seri} mono />
                <DetailRow label="Mark" value={alkes.mark} />
                <DetailRow label="Kelompok / Ruangan" value={alkes.group?.name} />
                <DetailRow label="Faskes Utama" value={alkes.faskes?.nama} />
              </dl>
            </section>

            {/* Pengadaan */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Histori Pengadaan</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Informasi pendanaan dan distribusi
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <DetailRow label="Tahun Pengadaan" value={alkes.thn_pengadaan ?? null} />
                <DetailRow
                  label="Harga"
                  value={alkes.harga != null ? formatRupiah(alkes.harga) : null}
                />
                <DetailRow label="Sumber Pendanaan" value={alkes.pendanaan} />
                <DetailRow label="Distributor" value={alkes.distributor} />
                <DetailRow label="No. AKL/AKD" value={alkes.akl_akd} />
                <DetailRow label="Keterangan" value={alkes.keterangan} />
              </dl>
            </section>

            {/* History Logs */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900">Log Aktivitas Sistem</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {logs.length} jejak rekaman tercatat
                  </p>
                </div>
              </div>

              {logsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
                  <p className="font-medium text-slate-500">Belum ada rekam jejak aktivitas</p>
                </div>
              ) : (
                <ol className="relative border-l-2 border-slate-100 ml-4 space-y-8 mt-4">
                  {logs.map((log) => {
                    const style = ACTION_STYLE[log.action] ?? {
                      label: log.action,
                      bg: 'bg-slate-50 border border-slate-200',
                      text: 'text-slate-700',
                      icon: '•',
                    };
                    const changes = extractChanges(log.metadata);
                    return (
                      <li key={log.id} className="pl-8 relative">
                        <span
                          className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full ${style.bg} ring-4 ring-white flex items-center justify-center text-[10px] shadow-sm`}
                        >
                          {style.icon}
                        </span>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {log.user?.name ?? 'Sistem Otomatis'}
                          </span>
                          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 bg-slate-50/50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">
                          {log.description}
                        </p>

                        {changes.length > 0 && (
                          <div className="mt-4 border border-slate-200/70 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-600">
                                <tr>
                                  <th className="text-left px-4 py-2 font-bold text-xs uppercase tracking-wider">
                                    Atribut
                                  </th>
                                  <th className="text-left px-4 py-2 font-bold text-xs uppercase tracking-wider">
                                    Sebelum
                                  </th>
                                  <th className="text-left px-4 py-2 font-bold text-xs uppercase tracking-wider">
                                    Sesudah
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {changes.map((c) => (
                                  <tr
                                    key={c.field}
                                    className="hover:bg-slate-50/50 transition-colors"
                                  >
                                    <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs">
                                      {c.label}
                                    </td>
                                    <td className="px-4 py-2.5 text-rose-600 line-through text-xs font-medium">
                                      {formatValue(c.field, c.before)}
                                    </td>
                                    <td className="px-4 py-2.5 text-emerald-700 text-xs font-bold bg-emerald-50/30">
                                      {formatValue(c.field, c.after)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="flex flex-col gap-8">
            {/* Status verifikasi */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Audit Status</h2>
                  <p className="text-sm font-medium text-slate-500">Masa berlaku & verifikasi</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-sm font-semibold text-slate-500">Kondisi Validasi</span>
                  {alkes.verification_status ? (
                    <VerificationBadge status={alkes.verification_status as VStatus} />
                  ) : (
                    <span className="font-bold text-slate-900">—</span>
                  )}
                </div>
                <div className="space-y-3 px-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Pemilik Data
                    </span>
                    <span className="font-bold text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded">
                      {alkes.creator?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Tgl Entri
                    </span>
                    <span className="font-medium text-slate-700 text-sm">
                      {formatDateTime(alkes.created_at as unknown as string)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Update Terakhir
                    </span>
                    <span className="font-medium text-slate-700 text-sm">
                      {formatDateTime(alkes.updated_at as unknown as string)}
                    </span>
                  </div>
                  {alkes.submitted_at && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-xs font-semibold text-amber-600 uppercase">
                        Diajukan Pada
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {formatDateTime(alkes.submitted_at)}
                      </span>
                    </div>
                  )}
                  {alkes.verified_at && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-xs font-semibold text-emerald-600 uppercase">
                        Diverifikasi Pada
                      </span>
                      <span className="font-bold text-emerald-700 text-sm">
                        {formatDateTime(alkes.verified_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Verification Timeline */}
            <section className={sectionCls}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Alur Verifikasi</h2>
                  <p className="text-sm font-medium text-slate-500">Jejak langkah persetujuan</p>
                </div>
              </div>
              <div className="pt-2">
                <VerificationTimeline alkesId={id} />
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[1000px] p-0 overflow-hidden gap-0 rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 text-white relative">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-white text-2xl font-bold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-200" />
                Perbarui Informasi Aset
              </DialogTitle>
              <DialogDescription className="text-indigo-100 mt-1 font-medium text-sm">
                Pastikan data yang dimasukkan akurat. Perubahan akan terekam secara otomatis.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[65vh] overflow-y-auto px-8 py-6 bg-slate-50/50 space-y-6">
            {form && (
              <>
                {/* Section: Identitas */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
                      Identitas Alat
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="nama_alat"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Nama Alat <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="nama_alat"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.nama_alat}
                        onChange={(e) => setForm({ ...form, nama_alat: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="merk"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Merk
                      </Label>
                      <Input
                        id="merk"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.merk}
                        onChange={(e) => setForm({ ...form, merk: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="type"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Type / Model
                      </Label>
                      <Input
                        id="type"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="no_seri"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        No. Seri
                      </Label>
                      <Input
                        id="no_seri"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl font-mono text-sm"
                        value={form.no_seri}
                        onChange={(e) => setForm({ ...form, no_seri: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="mark"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Mark / Keterangan Letak
                      </Label>
                      <Input
                        id="mark"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.mark}
                        onChange={(e) => setForm({ ...form, mark: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Pengadaan */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                    <Landmark className="w-4 h-4 text-green-600" />
                    <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
                      Histori Pengadaan
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label
                        htmlFor="thn_pengadaan"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Tahun Pengadaan
                      </Label>
                      <Input
                        id="thn_pengadaan"
                        type="number"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.thn_pengadaan}
                        onChange={(e) => setForm({ ...form, thn_pengadaan: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="harga"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Harga (Rupiah)
                      </Label>
                      <Input
                        id="harga"
                        type="number"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl font-mono text-sm"
                        value={form.harga}
                        onChange={(e) => setForm({ ...form, harga: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="pendanaan"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Sumber Pendanaan
                      </Label>
                      <Select
                        value={form.pendanaan || undefined}
                        onValueChange={(v) =>
                          setForm((f) => (f ? { ...f, pendanaan: v ?? '' } : f))
                        }
                      >
                        <SelectTrigger
                          id="pendanaan"
                          className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        >
                          <SelectValue placeholder="Pilih sumber pendanaan" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {PENDANAAN.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="distributor"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Distributor Vendor
                      </Label>
                      <Input
                        id="distributor"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        value={form.distributor}
                        onChange={(e) => setForm({ ...form, distributor: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="akl_akd"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Nomor Registrasi (AKL/AKD)
                      </Label>
                      <Input
                        id="akl_akd"
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl font-mono text-sm"
                        value={form.akl_akd}
                        onChange={(e) => setForm({ ...form, akl_akd: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Status */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
                      Kondisi & Status
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label
                        htmlFor="ada"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Ketersediaan Fisik
                      </Label>
                      <Select
                        value={form.ada}
                        onValueChange={(v) => setForm({ ...form, ada: v as 'Ya' | 'Tidak' })}
                      >
                        <SelectTrigger
                          id="ada"
                          className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Ya">✓ Ya, tersedia di ruangan</SelectItem>
                          <SelectItem value="Tidak">✕ Tidak tersedia / hilang</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="berfungsi"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Kondisi Operasional
                      </Label>
                      <Select
                        value={form.berfungsi}
                        onValueChange={(v) =>
                          setForm({ ...form, berfungsi: v as EditForm['berfungsi'] })
                        }
                      >
                        <SelectTrigger
                          id="berfungsi"
                          className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {KONDISI.map((k) => (
                            <SelectItem key={k.value} value={k.value}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="keterangan"
                        className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        Catatan Tambahan
                      </Label>
                      <Textarea
                        id="keterangan"
                        rows={4}
                        className="mt-1.5 focus-visible:ring-indigo-500 rounded-xl resize-none"
                        placeholder="Tuliskan catatan khusus terkait kondisi alat, jadwal kalibrasi, dll."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Upload Foto */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <Camera className="w-4 h-4 text-purple-600" />
                    <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">Tambah Foto</h3>
                  </div>
                  <input
                    ref={editPhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleEditPhotoAdd(e.target.files); e.target.value = ''; }}
                  />
                  {editPhotoPreviews.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                      {editPhotoPreviews.map((url, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: preview
                        <div key={i} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200">
                          <img src={url} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleEditPhotoRemove(i)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => editPhotoInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editPhotoInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl py-8 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <Camera className="w-8 h-8" />
                      <span className="text-sm font-medium">Klik untuk tambah foto</span>
                      <span className="text-xs">Maks. 10 foto, 5MB per foto</span>
                    </button>
                  )}
                </div>

                {/* Section: QR Code */}
                {qrUrl && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">QR Code</h3>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="w-24 h-24 shrink-0 bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-slate-500 truncate mb-2">{qrUrl}</p>
                        {qrWarnLocal && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-2">⚠ URL masih localhost, ubah PUBLIC_URL di .env.local</p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDownloadQr}
                          className="h-9 px-4 rounded-xl text-xs font-semibold gap-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download QR Code
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-8 py-5 bg-white border-t border-slate-100 gap-3 sm:justify-end rounded-b-2xl">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="gap-2 px-6 h-11 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
            >
              Batalkan
            </Button>
            <Button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !form?.nama_alat?.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2 shadow-md shadow-indigo-600/20 px-8 h-11 rounded-xl font-bold"
            >
              {updateMut.isPending ? 'Memproses...' : 'Simpan Pembaruan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={(reason) => rejectMut.mutate(reason)}
        isSubmitting={rejectMut.isPending}
      />

      {/* DELETE DIALOG */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-rose-50 px-6 py-8 text-center border-b border-rose-100">
            <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-rose-100">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-rose-900">Hapus Permanen?</DialogTitle>
            <DialogDescription className="mt-2 text-rose-700/80 font-medium">
              Aset <strong className="text-rose-900">{alkes?.nama_alat}</strong> akan dihapus
              beserta seluruh foto dan log riwayatnya. Data tidak dapat dipulihkan.
            </DialogDescription>
          </div>
          <DialogFooter className="px-6 py-4 bg-white gap-3 sm:justify-center">
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              className="w-full sm:w-auto rounded-xl font-semibold h-11 hover:bg-slate-100"
            >
              Kembali
            </Button>
            <Button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 rounded-xl font-bold h-11 shadow-md shadow-rose-600/20"
            >
              {deleteMut.isPending ? 'Memproses...' : 'Ya, Hapus Aset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
