'use client';
import { Button } from '@/components/ui/button';
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
import { api } from '@/lib/api';
import { buildAlkesScanUrl, isPublicUrlLocalhost } from '@/lib/publicUrl';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  ClipboardList,
  Download,
  Info,
  Package,
  QrCode,
  Save,
  Send,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ApiError = {
  response?: {
    data?: {
      error?: string;
      details?: Record<string, string[]>;
    };
  };
};

const PENDANAAN_OPTIONS = ['APBN', 'APBD', 'Hibah', 'KSO', 'BLU', 'JKLN'] as const;
type PendanaanValue = (typeof PENDANAAN_OPTIONS)[number];
type AlkesGroup = {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
  children?: AlkesGroup[];
};
type CodeMode = 'auto' | 'manual';

interface FormState {
  group_id: string;
  kode_alat: string;
  nama_alat: string;
  mark: string;
  no_seri: string;
  merk: string;
  type: string;
  thn_pengadaan: string;
  ada: 'Ya' | 'Tidak';
  berfungsi: 'Baik' | 'Rusak' | 'tdk beroperasi' | 'tdk berfungsi';
  harga: string;
  pendanaan: PendanaanValue | '';
  distributor: string;
  akl_akd: string;
  keterangan: string;
}

const initialForm: FormState = {
  group_id: '',
  kode_alat: '',
  nama_alat: '',
  mark: '',
  no_seri: '',
  merk: '',
  type: '',
  thn_pengadaan: '',
  ada: 'Tidak',
  berfungsi: 'Baik',
  harga: '',
  pendanaan: '',
  distributor: '',
  akl_akd: '',
  keterangan: '',
};

const KONDISI: { value: FormState['berfungsi']; label: string; color: string; ring: string }[] = [
  {
    value: 'Baik',
    label: 'Baik',
    color: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    value: 'Rusak',
    label: 'Rusak',
    color: 'border-rose-500 bg-rose-50 text-rose-700',
    ring: 'ring-rose-200',
  },
  {
    value: 'tdk beroperasi',
    label: 'Tdk Beroperasi',
    color: 'border-amber-500 bg-amber-50 text-amber-700',
    ring: 'ring-amber-200',
  },
  {
    value: 'tdk berfungsi',
    label: 'Tdk Berfungsi',
    color: 'border-slate-500 bg-slate-100 text-slate-700',
    ring: 'ring-slate-300',
  },
];

function flattenGroups(tree: AlkesGroup[]): AlkesGroup[] {
  const acc: AlkesGroup[] = [];
  const walk = (nodes: AlkesGroup[]) => {
    for (const n of nodes) {
      acc.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return acc;
}

function prefixFromGroupName(name: string): string {
  if (!name) return 'ALK';
  const words = name
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean);
  if (!words.length) return 'ALK';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return (
    words
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'ALK'
  );
}

function randomSuffix(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateKode(groupName: string): string {
  const d = new Date();
  const yymmdd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefixFromGroupName(groupName)}-${yymmdd}-${randomSuffix(4)}`;
}

export default function NewAlkesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const lockedRoomId = !isAdmin ? (user?.assigned_room_id ?? '') : '';
  const lockedRoomName = !isAdmin ? (user?.assigned_room?.name ?? '') : '';
  const [form, setForm] = useState<FormState>(() =>
    lockedRoomId ? { ...initialForm, group_id: lockedRoomId } : initialForm,
  );
  const [codeMode, setCodeMode] = useState<CodeMode>('auto');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: groupsData } = useQuery({
    queryKey: ['alkes-groups'],
    queryFn: () => api.get('/alkes/groups').then((r) => r.data.data),
  });

  const groupsTree: AlkesGroup[] = groupsData ?? [];
  const groupsFlat = useMemo(() => flattenGroups(groupsTree), [groupsTree]);
  const groupsLeaf = groupsFlat.filter((g) => !g.children || !g.children.length);
  const selectedGroup = groupsFlat.find((g) => g.id === form.group_id) ?? null;
  const selectedGroupName = selectedGroup?.name ?? lockedRoomName;

  useEffect(() => {
    if (!isAdmin && lockedRoomId && form.group_id !== lockedRoomId) {
      setForm((f) => ({ ...f, group_id: lockedRoomId }));
    }
  }, [isAdmin, lockedRoomId, form.group_id]);

  useEffect(() => {
    if (codeMode === 'auto') {
      setForm((f) => ({
        ...f,
        kode_alat: selectedGroupName ? generateKode(selectedGroupName) : '',
      }));
    }
  }, [codeMode, selectedGroupName]);

  const [qrUrl, setQrUrl] = useState('');
  const [qrWarnLocal, setQrWarnLocal] = useState(false);
  useEffect(() => {
    if (!form.kode_alat || form.kode_alat.length < 2) {
      setQrUrl('');
      return;
    }
    setQrUrl(buildAlkesScanUrl(form.kode_alat));
    setQrWarnLocal(isPublicUrlLocalhost());
  }, [form.kode_alat]);

  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    if (!qrUrl) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    QRCode.toCanvas(canvas, qrUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch((err) => {
      console.error('qr error', err);
    });
  }, [qrUrl]);

  useEffect(() => {
    return () => {
      for (const url of photoPreviews) URL.revokeObjectURL(url);
    };
  }, []);

  const [submitAfterCreate, setSubmitAfterCreate] = useState(false);

  const createMutation = useMutation({
    mutationFn: async ({ andSubmit }: { andSubmit: boolean }) => {
      const payload: Record<string, unknown> = {
        kode_alat: form.kode_alat.trim(),
        nama_alat: form.nama_alat.trim(),
        ada: form.ada,
        berfungsi: form.berfungsi,
      };
      if (form.mark.trim()) payload.mark = form.mark.trim();
      if (form.group_id) payload.group_id = form.group_id;
      if (form.no_seri.trim()) payload.no_seri = form.no_seri.trim();
      if (form.merk.trim()) payload.merk = form.merk.trim();
      if (form.type.trim()) payload.type = form.type.trim();
      if (form.thn_pengadaan) {
        const yr = Number(form.thn_pengadaan);
        if (!Number.isNaN(yr)) payload.thn_pengadaan = yr;
      }
      if (form.harga) {
        const h = Number(form.harga);
        if (!Number.isNaN(h)) payload.harga = h;
      }
      if (form.pendanaan) payload.pendanaan = form.pendanaan;
      if (form.distributor.trim()) payload.distributor = form.distributor.trim();
      if (form.akl_akd.trim()) payload.akl_akd = form.akl_akd.trim();
      if (form.keterangan.trim()) payload.keterangan = form.keterangan.trim();

      const created = await api.post('/alkes', payload).then((r) => r.data.data);

      if (photos.length > 0) {
        const fd = new FormData();
        for (const p of photos) fd.append('files', p);
        await api
          .post(`/alkes/${created.id}/images`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .catch((err) => {
            console.error('upload photos error', err);
            toast.warning(
              'Alkes tersimpan, tapi upload foto gagal. Silakan upload ulang di halaman detail.',
            );
          });
      }

      if (andSubmit && !isAdmin) {
        try {
          await api.post(`/alkes/${created.id}/submit`);
        } catch (err) {
          console.error('submit after create error', err);
          toast.warning(
            'Alkes tersimpan sebagai DRAFT, tapi gagal submit verifikasi. Silakan submit manual.',
          );
        }
      }
      return created;
    },
    onSuccess: (data) => {
      if (isAdmin) {
        toast.success('Alkes berhasil ditambahkan dan otomatis disetujui');
      } else if (submitAfterCreate) {
        toast.success('Alkes disimpan & dikirim untuk verifikasi');
      } else {
        toast.success('Alkes disimpan sebagai draft');
      }
      router.push(`/alkes/${data.id}`);
    },
    onError: (e: ApiError) => {
      const details = e.response?.data?.details;
      if (details && typeof details === 'object') {
        const entries = Object.entries(details).filter(
          ([, msgs]) => Array.isArray(msgs) && msgs.length > 0,
        );
        if (entries.length > 0) {
          const msg = entries.map(([field, msgs]) => `• ${field}: ${msgs.join(', ')}`).join('\n');
          toast.error(`Validasi gagal:\n${msg}`, { duration: 7000 });
          return;
        }
      }
      toast.error(e.response?.data?.error ?? 'Gagal menambahkan alkes');
    },
  });

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleRegenerateCode = () => {
    if (!selectedGroupName) {
      toast.error('Pilih kelompok dulu untuk generate kode otomatis');
      return;
    }
    handleChange('kode_alat', generateKode(selectedGroupName));
  };

  const handlePhotoAdd = (files: FileList | null) => {
    if (!files || !files.length) return;
    const remaining = 10 - photos.length;
    if (remaining <= 0) {
      toast.error('Maksimal 10 foto');
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    const valid = selected.filter((f) => {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name} bukan gambar`);
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} lebih dari 5MB`);
        return false;
      }
      return true;
    });
    setPhotos((p) => [...p, ...valid]);
    setPhotoPreviews((p) => [...p, ...valid.map((f) => URL.createObjectURL(f))]);
  };

  const handlePhotoRemove = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleDownloadBarcode = async () => {
    if (!form.kode_alat || !qrUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      const link = document.createElement('a');
      link.download = `qrcode-${form.kode_alat}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('download qr error', err);
      toast.error('Gagal mendownload QR code');
    }
  };

  const validate = () => {
    if (!form.kode_alat.trim() || !form.nama_alat.trim()) {
      toast.error('Kode alat dan nama alat wajib diisi');
      return false;
    }
    if (!isAdmin && !lockedRoomId) {
      toast.error('Akun Anda belum di-assign ke ruangan. Hubungi Admin.');
      return false;
    }
    if (!isAdmin && form.group_id !== lockedRoomId) {
      toast.error('Ruangan terkunci ke ruangan yang ditugaskan.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitAfterCreate(false);
    createMutation.mutate({ andSubmit: false });
  };

  const handleSaveAndSubmit = () => {
    if (!validate()) return;
    setSubmitAfterCreate(true);
    createMutation.mutate({ andSubmit: true });
  };

  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';
  const inputCls = 'h-11 focus-visible:ring-indigo-500 rounded-xl';
  const sectionCls = 'bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm';

  return (
    <form onSubmit={handleSaveDraft} className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200/60 pt-8 pb-6 px-6 lg:px-8 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 font-medium">
              <Link href="/alkes" className="hover:text-indigo-600 transition-colors font-semibold">
                Daftar Alkes
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-900 font-semibold">Tambah Baru</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Registrasi Aset Baru
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">
              Lengkapi form untuk mendaftarkan alat kesehatan ke sistem inventaris.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/alkes')}
              className="px-5 h-10 rounded-xl font-semibold text-slate-600 hover:bg-slate-200/50"
            >
              Batalkan
            </Button>

            {isAdmin ? (
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-bold gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'Memproses...' : 'Simpan Data'}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={createMutation.isPending}
                  className="h-10 px-5 rounded-xl border-slate-200 gap-2 font-semibold"
                >
                  <Save className="w-4 h-4" />
                  {createMutation.isPending && !submitAfterCreate ? 'Menyimpan...' : 'Simpan Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveAndSubmit}
                  disabled={createMutation.isPending}
                  className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md font-bold gap-2"
                >
                  <Send className="w-4 h-4" />
                  {createMutation.isPending && submitAfterCreate
                    ? 'Mengirim...'
                    : 'Ajukan Verifikasi'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Identitas */}
          <section className={sectionCls}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Identitas Alat</h2>
                <p className="text-sm font-medium text-slate-500">
                  Data fundamental aset dan kode seri
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <Label className={labelCls}>
                  Nama Alat <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.nama_alat}
                  onChange={(e) => handleChange('nama_alat', e.target.value)}
                  placeholder="Contoh: Tensimeter Digital"
                  className={inputCls}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>
                  Ruangan / Kelompok{!isAdmin && <span className="text-rose-500"> *</span>}
                </Label>
                {isAdmin ? (
                  <Select
                    value={form.group_id || 'none'}
                    onValueChange={(v) => handleChange('group_id', v === 'none' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="-- Pilih Kelompok --">
                        {form.group_id ? selectedGroupName : '-- Pilih Kelompok --'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">-- Pilih Kelompok --</SelectItem>
                      {groupsLeaf.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : lockedRoomId ? (
                  <Input
                    value={lockedRoomName || 'Ruangan yang ditugaskan'}
                    readOnly
                    className="h-11 bg-slate-50 text-slate-500 font-medium rounded-xl"
                  />
                ) : (
                  <div className="h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 flex items-center text-xs font-semibold text-amber-800">
                    Belum di-assign ke ruangan. Hubungi Admin.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className={labelCls}>
                    Kode Alat <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCodeMode('auto')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider ${codeMode === 'auto' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeMode('manual')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider ${codeMode === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={form.kode_alat}
                    onChange={(e) => handleChange('kode_alat', e.target.value)}
                    placeholder={codeMode === 'auto' ? 'Pilih kelompok' : 'Contoh: ALK-001'}
                    className={`${inputCls} font-mono`}
                    readOnly={codeMode === 'auto'}
                    required
                  />
                  {codeMode === 'auto' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRegenerateCode}
                      disabled={!selectedGroupName}
                      className="h-11 w-11 p-0 shrink-0 rounded-xl"
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Merk</Label>
                <Input
                  value={form.merk}
                  onChange={(e) => handleChange('merk', e.target.value)}
                  placeholder="Merk alat"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Type / Model</Label>
                <Input
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  placeholder="Tipe spesifik"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>No. Seri</Label>
                <Input
                  value={form.no_seri}
                  onChange={(e) => handleChange('no_seri', e.target.value)}
                  placeholder="Nomor seri produksi"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Mark / Catatan Letak</Label>
                <Input
                  value={form.mark}
                  onChange={(e) => handleChange('mark', e.target.value)}
                  placeholder="Misal: Lemari 2"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Pengadaan & Kondisi */}
          <section className={sectionCls}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pengadaan & Kondisi</h2>
                <p className="text-sm font-medium text-slate-500">
                  Riwayat perolehan dan status fisik
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label className={labelCls}>Tahun Pengadaan</Label>
                <Input
                  type="number"
                  value={form.thn_pengadaan}
                  onChange={(e) => handleChange('thn_pengadaan', e.target.value)}
                  placeholder="Contoh: 2024"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Harga (Rupiah)</Label>
                <Input
                  type="number"
                  value={form.harga}
                  onChange={(e) => handleChange('harga', e.target.value)}
                  placeholder="0"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Sumber Pendanaan</Label>
                <Select
                  value={form.pendanaan || 'none'}
                  onValueChange={(v) =>
                    handleChange('pendanaan', v === 'none' ? '' : (v as PendanaanValue))
                  }
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="-- Pilih Pendanaan --" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">-- Pilih Pendanaan --</SelectItem>
                    {PENDANAAN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Distributor</Label>
                <Input
                  value={form.distributor}
                  onChange={(e) => handleChange('distributor', e.target.value)}
                  placeholder="Nama vendor pengadaan"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className={labelCls}>Nomor Registrasi (AKL / AKD)</Label>
                <Input
                  value={form.akl_akd}
                  onChange={(e) => handleChange('akl_akd', e.target.value)}
                  placeholder="Nomor Izin Edar"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelCls}>Ketersediaan Fisik</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Ya', 'Tidak'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleChange('ada', val)}
                      className={`h-11 rounded-xl border-2 text-sm font-bold transition-all ${
                        form.ada === val
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      {val === 'Ya' ? '✓ Tersedia' : '✕ Tidak Ada'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className={labelCls}>Kondisi Operasional</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {KONDISI.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => handleChange('berfungsi', k.value)}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all ${
                        form.berfungsi === k.value
                          ? `${k.color} ${k.ring} ring-2`
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className={labelCls}>Catatan Tambahan</Label>
                <Textarea
                  value={form.keterangan}
                  onChange={(e) => handleChange('keterangan', e.target.value)}
                  placeholder="Tambahkan informasi penting..."
                  className="rounded-xl resize-none focus-visible:ring-indigo-500 mt-1"
                  rows={3}
                />
              </div>
            </div>
          </section>

          {/* Foto */}
          <section className={sectionCls}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">Galeri Foto</h2>
                <p className="text-sm font-medium text-slate-500">Dokumentasi fisik alat</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
                {photos.length}/10
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handlePhotoAdd(e.target.files);
                e.target.value = '';
              }}
            />

            {photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-2xl py-12 transition-colors flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-600 group"
              >
                <div className="w-16 h-16 rounded-full bg-slate-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-500" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold block mb-1">Upload dokumentasi foto</span>
                  <span className="text-xs font-medium text-slate-400">
                    Format JPEG/PNG/WebP, maks 5MB
                  </span>
                </div>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={src}
                    className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-200"
                  >
                    <img
                      src={src}
                      className="w-full h-full object-cover"
                      alt={`Preview ${idx + 1}`}
                    />
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                        UTAMA
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePhotoRemove(idx)}
                      className="absolute top-2 right-2 w-7 h-7 bg-rose-500 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50/50 hover:bg-indigo-50/50"
                  >
                    <UploadCloud className="w-6 h-6" />
                    <span className="text-[11px] font-bold">Tambah</span>
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <aside className="flex flex-col gap-8">
          <section className={sectionCls}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">QR Label</h2>
                <p className="text-sm font-medium text-slate-500">Preview tag fisik</p>
              </div>
            </div>

            {form.kode_alat ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
                  <canvas
                    ref={qrCanvasRef}
                    className="max-w-full h-auto mix-blend-multiply relative z-10"
                  />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-sm font-mono font-bold text-slate-800 tracking-tight bg-slate-100 py-2 px-4 rounded-xl inline-block border border-slate-200">
                    {form.kode_alat}
                  </p>
                </div>

                {qrWarnLocal && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-xs font-medium text-amber-800">
                      Anda sedang menggunakan <strong className="font-bold">localhost</strong>. QR
                      ini tidak akan bisa di-scan dari HP. Ganti ke IP jaringan lokal di
                      konfigurasi.
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadBarcode}
                  className="w-full h-11 rounded-xl font-bold gap-2 text-slate-700 hover:bg-slate-100"
                >
                  <Download className="w-4 h-4" />
                  Unduh Label PNG
                </Button>
              </div>
            ) : (
              <div className="py-12 text-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
                <QrCode className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
                Input kode alat untuk memunculkan QR.
              </div>
            )}
          </section>

          <section className={sectionCls}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Ringkasan</h2>
                <p className="text-sm font-medium text-slate-500">Preview data form</p>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              {[
                ['Nama Alat', form.nama_alat || '—'],
                ['Kode', form.kode_alat || '—'],
                ['Kondisi', form.berfungsi],
                ['Foto', `${photos.length} dilampirkan`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center gap-4 py-1">
                  <dt className="text-slate-500 font-semibold">{k}</dt>
                  <dd className="text-slate-900 font-bold truncate max-w-[150px]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </form>
  );
}
