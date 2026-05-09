'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Link as LinkIcon,
  Loader2,
  PackageCheck,
  PackageSearch,
  QrCode,
  ShoppingBag,
  UploadCloud,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';

type InventoryRequestItem = {
  id: string;
  request_no: string;
  nama_alat: string;
  quantity: number;
  status: string;
  procurement_photo_url?: string | null;
  qr_code?: string | null;
  requester?: { name: string } | null;
  group?: { name: string } | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  APPROVED: {
    label: 'Disetujui',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  FULFILLED: {
    label: 'Sudah Dibeli',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export default function InventarisPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [generateQr, setGenerateQr] = useState(true);
  const [isCompressing, setIsCompressing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('asc');
    }
  };

  // --- OCR States ---
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState<{ sn?: string; brand?: string } | null>(null);

  const runOCR = async (imageSrc: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setOcrResults(null);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(imageSrc, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') setScanProgress(Math.round(m.progress * 100));
        },
      });

      // Simple heuristic parsing
      const snMatch = text.match(/(?:S\/N|SN|Serial|Serial No|Serial Number)[:.\s]*([A-Z0-9-]+)/i);
      const brandKeywords = [
        'GE',
        'Philips',
        'Siemens',
        'Samsung',
        'Canon',
        'Mindray',
        'Bionet',
        'Fukuda',
        'Toshiba',
        'Hitachi',
      ];
      const brandFound = brandKeywords.find((b) => text.toLowerCase().includes(b.toLowerCase()));

      if (snMatch || brandFound) {
        setOcrResults({
          sn: snMatch ? snMatch[1] : undefined,
          brand: brandFound || undefined,
        });
        toast.info('AI OCR: Teks penting terdeteksi!');
      }
    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['inventaris', 'requests', search, sortBy, order],
    queryFn: async () => {
      const res = await api.get('/requests', {
        params: {
          page: 1,
          limit: 100,
          inventaris: true,
          q: search || undefined,
          sort_by: sortBy || undefined,
          order: order || undefined,
        },
      });
      const rows: InventoryRequestItem[] = res.data?.data ?? [];
      return rows;
    },
  });

  const procureMut = useMutation({
    mutationFn: async (payload: {
      id: string;
      procurement_photo_url: string;
      generate_qr: boolean;
    }) => {
      const { id, ...body } = payload;
      return api.patch(`/requests/${id}/procure`, body);
    },
    onSuccess: () => {
      toast.success('Pembelian berhasil dikonfirmasi!');
      setOpenRowId(null);
      setPhotoUrl('');
      setGenerateQr(true);
      queryClient.invalidateQueries({ queryKey: ['inventaris', 'requests'] });
    },
    onError: () => toast.error('Gagal memproses pembelian'),
  });

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === 'APPROVED').length;
  const fulfilled = rows.filter((r) => r.status === 'FULFILLED').length;
  const displayRows = rows;

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageData = displayRows.slice(start, start + pageSize);

  const openProcure = (id: string) => {
    setOpenRowId(id);
    setPhotoUrl('');
    setGenerateQr(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 pt-5 pb-4 px-4 sm:px-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
              <span className="font-semibold text-slate-800">Inventaris</span>
              <ChevronRight className="w-3 h-3" />
              <span>Manajemen Pengadaan</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                <PackageSearch className="w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Manajemen Inventaris
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Pantau & proses pembelian aset yang diajukan
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-5 space-y-4">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total Pengajuan',
              value: isLoading ? '—' : rows.length,
              icon: <ShoppingBag className="w-4 h-4" />,
              color: 'text-slate-700',
              bg: 'bg-white',
              border: 'border-slate-200',
            },
            {
              label: 'Menunggu Proses',
              value: isLoading ? '—' : pending,
              icon: <Loader2 className="w-4 h-4" />,
              color: 'text-amber-700',
              bg: 'bg-amber-50',
              border: 'border-amber-200',
            },
            {
              label: 'Sudah Dibeli',
              value: isLoading ? '—' : fulfilled,
              icon: <PackageCheck className="w-4 h-4" />,
              color: 'text-emerald-700',
              bg: 'bg-emerald-50',
              border: 'border-emerald-200',
            },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-3 shadow-sm`}>
              <div className={`flex items-center gap-2 ${s.color} mb-1`}>
                {s.icon}
                <span className="text-[11px] font-semibold">{s.label}</span>
              </div>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <PackageSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama barang atau nomor pengajuan..."
                  className="h-10 w-full pl-10 pr-8 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white font-medium transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 shrink-0 self-center hidden sm:inline mr-2">
                  {displayRows.length} item
                </span>
                {(search || sortBy !== 'created_at' || order !== 'desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSortBy('created_at');
                      setOrder('desc');
                    }}
                    className="h-10 px-3 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th
                    className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('request_no')}
                  >
                    <div className="flex items-center gap-1">
                      No. Pengajuan
                      {sortBy === 'request_no' ? (
                        order === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('nama_alat')}
                  >
                    <div className="flex items-center gap-1">
                      Nama Barang
                      {sortBy === 'nama_alat' ? (
                        order === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Qty
                      {sortBy === 'quantity' ? (
                        order === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Pemohon
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Ruangan
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === 'status' ? (
                        order === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  {isAdmin && (
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <tr key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!isLoading && displayRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <Inbox className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-500">
                          {search
                            ? `Tidak ada hasil untuk "${search}"`
                            : 'Belum ada pengajuan yang disetujui'}
                        </p>
                        <p className="text-xs max-w-xs">
                          Pengajuan alat yang telah disetujui Admin akan tampil di sini untuk
                          diproses.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  pageData.map((row) => {
                    const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.APPROVED;
                    const isOpen = openRowId === row.id;

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className={`hover:bg-indigo-50/20 transition-colors ${isOpen ? 'bg-indigo-50/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                              {row.request_no}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 text-sm">{row.nama_alat}</p>
                            {/* Mobile-only info */}
                            <div className="flex flex-wrap gap-1.5 mt-1 md:hidden">
                              {row.requester && (
                                <span className="text-[10px] text-slate-500">
                                  {row.requester.name}
                                </span>
                              )}
                              {row.group && (
                                <span className="text-[10px] text-indigo-600 font-semibold">
                                  {row.group.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs">
                              {row.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm hidden md:table-cell">
                            {row.requester?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {row.group ? (
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                {row.group.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              {row.status === 'APPROVED' ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    isOpen ? setOpenRowId(null) : openProcure(row.id)
                                  }
                                  className={`h-8 rounded-xl text-xs font-bold gap-1.5 ${
                                    isOpen
                                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                  }`}
                                >
                                  {isOpen ? (
                                    <>
                                      <X className="w-3.5 h-3.5" /> Tutup
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingBag className="w-3.5 h-3.5" /> Proses Beli
                                    </>
                                  )}
                                </Button>
                              ) : row.status === 'FULFILLED' ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Menunggu...</span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Inline Procure Form */}
                        {isOpen && isAdmin && (
                          <tr className="bg-indigo-50/40 border-l-2 border-indigo-500">
                            <td colSpan={7} className="px-4 sm:px-6 py-5">
                              <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-5 w-full">
                                <div className="flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                    <ShoppingBag className="w-4.5 h-4.5" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-900">
                                      Konfirmasi Pembelian
                                    </h4>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                      Memproses:{' '}
                                      <strong className="text-indigo-700">{row.nama_alat}</strong>
                                      <span className="ml-1.5 font-mono text-xs text-slate-400">
                                        ({row.request_no})
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                  {/* Photo */}
                                  <div>
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                                      Bukti Pembelian
                                    </p>
                                    <Tabs defaultValue="upload" className="w-full">
                                      <TabsList className="grid grid-cols-2 h-8 mb-3 bg-slate-100 p-0.5 rounded-lg">
                                        <TabsTrigger
                                          value="upload"
                                          className="rounded-md text-xs h-full gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold"
                                        >
                                          <UploadCloud className="w-3.5 h-3.5" /> Upload
                                        </TabsTrigger>
                                        <TabsTrigger
                                          value="url"
                                          className="rounded-md text-xs h-full gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold"
                                        >
                                          <LinkIcon className="w-3.5 h-3.5" /> URL
                                        </TabsTrigger>
                                      </TabsList>

                                      <TabsContent value="upload" className="mt-0 space-y-2">
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          disabled={isCompressing}
                                          className="h-10 text-xs file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-3 file:mr-3 file:-my-1.5 cursor-pointer border-slate-200 rounded-xl"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                              setIsCompressing(true);
                                              const compressed = await imageCompression(file, {
                                                maxSizeMB: 1,
                                                maxWidthOrHeight: 1200,
                                                useWebWorker: true,
                                              });
                                              const reader = new FileReader();
                                              reader.readAsDataURL(compressed);
                                              reader.onloadend = () => {
                                                const base64 = reader.result as string;
                                                setPhotoUrl(base64);
                                                setIsCompressing(false);
                                                runOCR(base64); // Mulai AI OCR
                                              };
                                            } catch {
                                              setIsCompressing(false);
                                            }
                                          }}
                                        />
                                        {isScanning && (
                                          <div className="space-y-2 mt-2">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 uppercase">
                                              <span>AI sedang memindai foto...</span>
                                              <span>{scanProgress}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-indigo-500 transition-all duration-300"
                                                style={{ width: `${scanProgress}%` }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                        {ocrResults && (
                                          <div className="mt-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2 animate-in zoom-in-95">
                                            <p className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1.5">
                                              <PackageSearch className="w-3 h-3" /> Hasil Pemindaian
                                              AI
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {ocrResults.sn && (
                                                <div className="bg-white px-2 py-1 rounded-lg border border-indigo-200 text-xs">
                                                  <span className="text-slate-400 mr-1">SN:</span>
                                                  <span className="font-bold text-indigo-700">
                                                    {ocrResults.sn}
                                                  </span>
                                                </div>
                                              )}
                                              {ocrResults.brand && (
                                                <div className="bg-white px-2 py-1 rounded-lg border border-indigo-200 text-xs">
                                                  <span className="text-slate-400 mr-1">Merk:</span>
                                                  <span className="font-bold text-indigo-700">
                                                    {ocrResults.brand}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {isCompressing && (
                                          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 font-medium">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
                                            Mengompres...
                                          </div>
                                        )}
                                        {!isCompressing && photoUrl.startsWith('data:image') && (
                                          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 font-semibold">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Siap diunggah (
                                            {(photoUrl.length / 1024).toFixed(0)}KB)
                                          </div>
                                        )}
                                      </TabsContent>

                                      <TabsContent value="url" className="mt-0">
                                        <Input
                                          placeholder="https://contoh.com/foto.jpg"
                                          value={photoUrl.startsWith('data:image') ? '' : photoUrl}
                                          onChange={(e) => setPhotoUrl(e.target.value)}
                                          className="h-10 rounded-xl border-slate-200 text-sm"
                                        />
                                      </TabsContent>
                                    </Tabs>
                                  </div>

                                  {/* QR */}
                                  <div className="flex items-center">
                                    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors w-full">
                                      <input
                                        type="checkbox"
                                        checked={generateQr}
                                        onChange={(e) => setGenerateQr(e.target.checked)}
                                        className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div>
                                        <span className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                                          <QrCode className="w-4 h-4 text-indigo-500" /> Generate QR
                                          Code
                                        </span>
                                        <span className="text-xs text-slate-500 mt-1 block leading-relaxed">
                                          Buat kode QR unik untuk pelacakan fisik aset.
                                        </span>
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                                  <Button
                                    disabled={!photoUrl || procureMut.isPending || isCompressing}
                                    onClick={() =>
                                      procureMut.mutate({
                                        id: row.id,
                                        procurement_photo_url: photoUrl,
                                        generate_qr: generateQr,
                                      })
                                    }
                                    className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
                                  >
                                    {procureMut.isPending ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-4 h-4" /> Selesaikan Pembelian
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setOpenRowId(null);
                                      setPhotoUrl('');
                                      setGenerateQr(true);
                                    }}
                                    disabled={procureMut.isPending}
                                    className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 font-semibold"
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {/* Pagination Footer */}
          {!isLoading && displayRows.length > 0 && (
            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>
                  Tampilkan{' '}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="mx-1 h-7 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>{' '}
                  baris per halaman
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="hidden sm:inline">
                  <strong className="text-slate-700">{start + 1}</strong>–
                  <strong className="text-slate-700">
                    {Math.min(start + pageSize, displayRows.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-700">{displayRows.length}</strong> item
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={safePage <= 1}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (safePage <= 3) pageNum = i + 1;
                  else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = safePage - 2 + i;
                  return (
                    <button
                      type="button"
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${safePage === pageNum ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage >= totalPages}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
