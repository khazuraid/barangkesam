'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiBaseUrl } from '@/lib/publicUrl';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Factory,
  Hash,
  Info,
  Package,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

type PublicAlkes = {
  id: string;
  kode_alat: string;
  nama_alat: string;
  merk: string | null;
  type: string | null;
  no_seri: string | null;
  thn_pengadaan: number | null;
  ada: string | null;
  berfungsi: string | null;
  akl_akd: string | null;
  keterangan: string | null;
  image_url: string | null;
  updated_at: string;
  group: { id: string; name: string } | null;
  images: Array<{ id: string; url: string; is_primary: boolean; urutan: number }>;
  group_path: string[];
};

const BERFUNGSI_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  Baik: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Baik',
  },
  Rusak: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Rusak',
  },
  'tdk beroperasi': {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Tidak Beroperasi',
  },
  'tdk berfungsi': {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    label: 'Tidak Berfungsi',
  },
};

async function fetchPublicAlkes(code: string): Promise<PublicAlkes> {
  // Pakai helper agar otomatis swap `localhost` → hostname LAN saat diakses dari HP.
  const apiUrl = getApiBaseUrl();
  const res = await fetch(`${apiUrl}/public/alkes/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Alat tidak ditemukan');
    throw new Error('Gagal memuat data');
  }
  const json = (await res.json()) as { data: PublicAlkes };
  return json.data;
}

export default function PublicAlkesPage() {
  const { code } = useParams<{ code: string }>();
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-alkes', code],
    queryFn: () => fetchPublicAlkes(code),
    enabled: !!code,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <Info className="h-8 w-8 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Data Tidak Ditemukan</h2>
              <p className="mt-1 text-sm text-slate-500">
                {(error as Error)?.message ??
                  `Kode "${code}" tidak terdaftar dalam sistem inventaris.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alkes = data;
  const primaryImg = alkes.images.find((i) => i.is_primary) ?? alkes.images[0];
  const activeImgUrl = selectedImg ?? primaryImg?.url ?? alkes.image_url ?? null;
  const kondisi =
    (alkes.berfungsi ? BERFUNGSI_STYLE[alkes.berfungsi] : undefined) ??
    BERFUNGSI_STYLE['tdk berfungsi'];

  const specs: Array<{ icon: React.ReactNode; label: string; value: string | number }> = [
    { icon: <Hash className="h-4 w-4" />, label: 'No Seri', value: alkes.no_seri ?? '-' },
    { icon: <Tag className="h-4 w-4" />, label: 'Merk', value: alkes.merk ?? '-' },
    { icon: <Factory className="h-4 w-4" />, label: 'Type', value: alkes.type ?? '-' },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Tahun Pengadaan',
      value: alkes.thn_pengadaan ?? '-',
    },
    { icon: <Package className="h-4 w-4" />, label: 'Ketersediaan', value: alkes.ada ?? '-' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'AKL/AKD', value: alkes.akl_akd ?? '-' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003ec7]">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">MedAsset AI</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Info Publik Alat
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-3 w-3" />
            Terverifikasi
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-6 shadow-sm">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 uppercase tracking-wider font-semibold">
                <Hash className="h-3 w-3 mr-1" />
                {alkes.kode_alat}
              </Badge>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${kondisi.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${kondisi.dot}`} />
                {kondisi.label}
              </span>
              {alkes.group?.name && (
                <Badge variant="outline" className="text-slate-600">
                  <Building2 className="h-3 w-3 mr-1" />
                  {alkes.group.name}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight break-words sm:text-3xl">
              {alkes.nama_alat}
            </h1>
            {[alkes.merk, alkes.type].filter(Boolean).length > 0 && (
              <p className="text-sm text-slate-500">
                {[alkes.merk, alkes.type].filter(Boolean).join(' · ')}
              </p>
            )}
            {alkes.group_path.length > 0 && (
              <p className="text-xs text-slate-400">{alkes.group_path.join(' › ')}</p>
            )}
          </div>
        </div>

        {/* Gallery */}
        {(alkes.images.length > 0 || activeImgUrl) && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Foto Alat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {activeImgUrl ? (
                  <img
                    src={activeImgUrl}
                    alt={alkes.nama_alat}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <p className="text-sm">Tidak ada foto</p>
                  </div>
                )}
              </div>
              {alkes.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {alkes.images.map((img) => {
                    const active = selectedImg === img.url || (!selectedImg && img.is_primary);
                    return (
                      <button
                        type="button"
                        key={img.id}
                        onClick={() => setSelectedImg(img.url)}
                        className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${active ? 'border-[#003ec7] ring-2 ring-blue-100' : 'border-transparent hover:border-slate-200'}`}
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Specs */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informasi Alat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm border border-slate-100">
                    {spec.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">{spec.label}</p>
                    <p className="mt-0.5 font-medium text-slate-900 break-words">{spec.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {alkes.keterangan && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Keterangan
                </p>
                <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                  {alkes.keterangan}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="py-6 text-center text-xs text-slate-400">
          <p>
            Diperbarui:{' '}
            {new Date(alkes.updated_at).toLocaleDateString('id-ID', {
              dateStyle: 'long',
            })}
          </p>
          <p className="mt-1">© {new Date().getFullYear()} MedAsset AI · Info Publik</p>
        </div>
      </main>
    </div>
  );
}
