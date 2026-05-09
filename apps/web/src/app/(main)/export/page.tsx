'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { Item } from '@/types/api';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Info,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type ExportType = 'alkes' | 'prasarana';

export default function ExportPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [loadingType, setLoadingType] = useState<ExportType | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">
          Maaf, Anda tidak memiliki izin untuk mengakses halaman Export. Fitur ini hanya tersedia untuk Administrator.
        </p>
      </div>
    );
  }


  const { data: groups, isLoading: groupsLoading } = useQuery<Item[]>({
    queryKey: ['alkes-groups-export'],
    queryFn: async () => {
      const r = await api.get('/alkes/groups', { params: { limit: 100 } });
      return (r.data.data ?? []) as Item[];
    },
  });

  const selected = useMemo(
    () => groups?.find((f) => f.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const handleExport = async (type: ExportType) => {
    if (!selectedGroupId) {
      toast.error('Pilih kelompok terlebih dahulu');
      return;
    }
    setLoadingType(type);
    try {
      const res = await api.get(`/export/${type}`, {
        params: { group_id: selectedGroupId },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      const slug = selected?.kode_rs ?? selectedGroupId;
      a.download = `Export_${type}_${slug}_${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${type} berhasil diunduh`);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? `Export ${type} gagal`);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div>
      <div className="space-y-6 p-6">
        {/* Hero */}
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">
            Export Data ASPAK
          </h2>
          <p className="text-slate-500 text-sm">
            Unduh data alkes dan prasarana dalam format Excel yang kompatibel dengan sistem
            Kemenkes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left:  selector + Actions */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/*  filter card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3 border-slate-100 border-b pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eff4ff] text-[#003ec7]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Fasilitas Kesehatan</h3>
                  <p className="text-slate-500 text-xs">
                    Pilih kelompok yang datanya akan diekspor.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="group-select">Kelompok</Label>
                <Select value={selectedGroupId} onValueChange={(v) => setSelectedGroupId(v ?? '')}>
                  <SelectTrigger id="group-select" className="h-11">
                    <SelectValue placeholder={groupsLoading ? 'Memuat...' : 'Pilih kelompok...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nama} ({f.kode_rs})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#c7d8ff] bg-[#eff4ff] p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#003ec7]" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-slate-900">{selected.nama}</p>
                    <p className="text-slate-600 text-xs">
                      Kode: <span className="font-mono">{selected.kode_rs}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExportCard
                title="Export Alkes"
                subtitle="Format ASPAK f3 (.xlsx)"
                description="Data alat kesehatan lengkap dengan kelompok, jumlah, dan kondisi sesuai standar ASPAK."
                Icon={Stethoscope}
                accent="bg-[#eff4ff] text-[#003ec7]"
                disabled={!selectedGroupId}
                loading={loadingType === 'alkes'}
                onClick={() => handleExport('alkes')}
              />
              <ExportCard
                title="Export Prasarana"
                subtitle="Format ASPAK f2 (.xlsx)"
                description="Data prasarana fasilitas kesehatan — segera tersedia di versi berikutnya."
                Icon={Layers}
                accent="bg-slate-100 text-slate-400"
                disabled
                comingSoon
              />
            </div>
          </div>

          {/* Right: Info sidebar */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#003ec7]" />
                <h4 className="font-semibold text-slate-900 text-sm">Kompatibilitas ASPAK</h4>
              </div>
              <ul className="space-y-2.5 text-slate-600 text-xs">
                <InfoLine icon={ShieldCheck}>
                  File hasil ekspor mengikuti template resmi Kemenkes.
                </InfoLine>
                <InfoLine icon={FileSpreadsheet}>
                  Dapat langsung diunggah ulang ke sistem ASPAK tanpa konversi.
                </InfoLine>
                <InfoLine icon={Clock}>
                  Nama file otomatis menyertakan kode kelompok dan tanggal.
                </InfoLine>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600">
                  <Info className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-amber-900">Tips</p>
                  <p className="mt-1 leading-relaxed text-amber-800">
                    Periksa hasil ekspor pada aplikasi spreadsheet sebelum mengunggah ke sistem
                    ASPAK Kemenkes untuk memastikan tidak ada data kritikal yang kosong.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportCard({
  title,
  subtitle,
  description,
  Icon,
  accent,
  disabled,
  loading,
  onClick,
  comingSoon,
}: {
  title: string;
  subtitle: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition ${
        disabled
          ? 'border-slate-200 opacity-80'
          : 'border-slate-200 hover:-translate-y-0.5 hover:border-[#c7d8ff] hover:shadow-md'
      }`}
    >
      {comingSoon && (
        <Badge className="absolute top-3 right-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700 text-xs">
          Segera Hadir
        </Badge>
      )}
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-slate-500 text-xs">{subtitle}</p>
      <p className="mt-3 flex-1 text-slate-600 text-sm leading-relaxed">{description}</p>
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`mt-5 w-full gap-2 ${
          disabled
            ? 'cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100'
            : 'bg-[#003ec7] text-white hover:bg-[#0052ff]'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengunduh...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {comingSoon ? 'Belum Tersedia' : 'Download Excel'}
          </>
        )}
      </Button>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
