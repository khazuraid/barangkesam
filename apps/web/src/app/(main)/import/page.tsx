'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import type { ImportError } from '@/types/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  FileSpreadsheet,
  FileWarning,
  History,
  Info,
  Layers,
  Link as LinkIcon,
  Loader2,
  Play,
  Search,
  Stethoscope,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ImportLogItem = {
  id: string;
  filename: string;
  status: 'DONE' | 'FAILED' | 'PROCESSING' | string;
  total_rows: number | null;
  success_rows: number | null;
  failed_rows: number | null;
  created_at: string;
};

type ImportLogsResponse = {
  data: ImportLogItem[];
};

type AlkesGroup = {
  id: string;
  name: string;
  level: number;
};

type PreviewGroup = {
  name: string;
  count: number;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}d lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
}

export default function ImportPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'alkes' | 'prasarana'>('alkes');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: ImportError[];
  } | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">
          Maaf, Anda tidak memiliki izin untuk mengakses halaman Import. Fitur ini hanya tersedia untuk Administrator.
        </p>
      </div>
    );
  }


  // States
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);

  // Mapping states
  const [previewGroups, setPreviewGroups] = useState<PreviewGroup[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isMappingMode, setIsMappingMode] = useState(false);

  const { data: recentLogs, refetch: refetchLogs } = useQuery<ImportLogsResponse>({
    queryKey: ['import-logs', 'recent'],
    queryFn: async () => {
      const r = await api.get('/import/logs', { params: { limit: 5 } });
      return r.data.data as ImportLogsResponse;
    },
  });

  const { data: existingGroups } = useQuery<{ data: { data: AlkesGroup[] } }>({
    queryKey: ['alkes-groups'],
    queryFn: () => api.get('/alkes/groups', { params: { limit: 100 } }),
  });

  const clusters = existingGroups?.data?.data?.filter((g) => g.level <= 2) || [];

  useEffect(() => {
    const socket = connectSocket();
    socket.on('import:progress', (data: { pct: number }) => setProgress(data.pct));
    socket.on(
      'import:completed',
      (data: { success: number; failed: number; errors: ImportError[] }) => {
        setResult(data);
        setProgress(100);
        refetchLogs();
      },
    );
    return () => {
      socket.off('import:progress');
      socket.off('import:completed');
    };
  }, [refetchLogs]);

  const previewMutation = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      return api.post('/import/alkes/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      setPreviewGroups(res.data.data.groups);
      setIsMappingMode(true);
      setMapping({});
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Gagal membaca file');
    },
  });

  const importMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('File tidak ada');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('group_mapping', JSON.stringify(mapping));
      return api.post('/import/alkes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onMutate: () => {
      setProgress(0);
      setResult(null);
    },
    onSuccess: (res) => {
      toast.success(`Import berhasil dieksekusi di latar belakang`);
      setIsMappingMode(false);
      setPreviewGroups(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Import gagal');
    },
  });

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(xls|xlsx)$/i.test(f.name)) {
      toast.error('Format file harus .xls atau .xlsx');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }
    setFile(f);
    setResult(null);
    setIsMappingMode(false);
    setPreviewGroups(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleMapChange = (groupName: string, clusterId: string) => {
    setMapping((prev) => ({ ...prev, [groupName]: clusterId }));
  };

  // --- AI Smart Mapping (Fuzzy String Similarity) ---
  const calculateSimilarity = (s1: string, s2: string) => {
    const a = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bigramsA = new Set();
    for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bigram = b.slice(i, i + 2);
      if (bigramsA.has(bigram)) intersection++;
    }
    return (2.0 * intersection) / (a.length - 1 + b.length - 1);
  };

  const handleAutoMap = () => {
    if (!previewGroups || clusters.length === 0) return;
    const newMapping = { ...mapping };
    let mappedCount = 0;

    for (const group of previewGroups) {
      if (newMapping[group.name]) continue; // Skip if already mapped

      let bestMatchId = '';
      let highestScore = 0;

      for (const cluster of clusters) {
        const score = calculateSimilarity(group.name, cluster.name);
        if (score > highestScore && score > 0.4) {
          // Threshold 0.4
          highestScore = score;
          bestMatchId = cluster.id;
        }
      }

      if (bestMatchId) {
        newMapping[group.name] = bestMatchId;
        mappedCount++;
      }
    }

    setMapping(newMapping);
    if (mappedCount > 0) {
      toast.success(`AI Auto-Map: ${mappedCount} kelompok berhasil dipetakan!`);
    } else {
      toast.info('AI Auto-Map: Tidak ada kecocokan tinggi yang ditemukan.');
    }
  };

  return (
    <div>
      <div className="space-y-6 p-6">
        {/* Hero */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">
              Import Data Excel (ASPAK)
            </h2>
            <p className="mt-1 text-slate-500 text-sm">
              Unggah file Excel ASPAK, petakan ke klaster, dan biarkan sistem bekerja.
            </p>
          </div>
          <Link href="/import/logs">
            <Button variant="outline" className="h-10 gap-2">
              <History className="h-4 w-4" />
              Riwayat Import
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <TabBtn active={tab === 'alkes'} onClick={() => setTab('alkes')} icon={Stethoscope}>
            Import Alkes
          </TabBtn>
          <TabBtn
            active={tab === 'prasarana'}
            onClick={() => setTab('prasarana')}
            icon={Layers}
            badge="Segera"
          >
            Import Prasarana
          </TabBtn>
        </div>

        {tab === 'prasarana' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Layers className="h-7 w-7" />
            </div>
            <h3 className="font-semibold text-lg text-slate-800">Import Prasarana Segera Hadir</h3>
            <p className="mx-auto mt-1 max-w-md text-slate-500 text-sm">
              Fitur import massal prasarana sedang dalam tahap pengembangan. Untuk sementara, Anda
              dapat menambahkan prasarana melalui halaman Prasarana.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left / main */}
            <div className="space-y-6 lg:col-span-2">
              {/* Mapping Mode UI */}
              {isMappingMode && previewGroups ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <div className="mb-4 flex items-center justify-between border-slate-100 border-b pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Pemilahan Klaster</h3>
                        <p className="text-slate-500 text-xs">
                          Petakan kelompok dari Excel ke dalam Klaster di database.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleAutoMap}
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm text-xs h-9 px-3"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        AI Auto-Map
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsMappingMode(false)}>
                        Batal
                      </Button>
                    </div>
                  </div>

                  {/* AI Stats */}
                  {previewGroups.length > 0 && (
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold">
                        ✓ {Object.keys(mapping).filter((k) => !!mapping[k]).length} dipetakan
                      </span>
                      <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold">
                        {previewGroups.length -
                          Object.keys(mapping).filter((k) => !!mapping[k]).length}{' '}
                        belum dipetakan
                      </span>
                    </div>
                  )}
                  <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
                    {previewGroups.map((group) => {
                      const isMapped = !!mapping[group.name];
                      let bestScore = 0;
                      let bestClusterId = '';
                      for (const cluster of clusters) {
                        const score = calculateSimilarity(group.name, cluster.name);
                        if (score > bestScore) {
                          bestScore = score;
                          bestClusterId = cluster.id;
                        }
                      }
                      const isAiSuggested =
                        isMapped && mapping[group.name] === bestClusterId && bestScore > 0.4;
                      const confidencePct = Math.round(bestScore * 100);
                      return (
                        <div
                          key={group.name}
                          className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${
                            isMapped
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isMapped
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white border-2 border-slate-300 text-slate-400'
                            }`}
                          >
                            {isMapped ? '✓' : '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-800 text-sm">
                                {group.name}
                              </span>
                              {isAiSuggested && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-200 flex items-center gap-1">
                                  <Wand2 className="w-2.5 h-2.5 inline" /> AI {confidencePct}%
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{group.count} aset</span>
                          </div>
                          <div className="w-2/5 shrink-0">
                            <select
                              className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 transition-all ${
                                isMapped
                                  ? 'border-emerald-300 bg-white text-slate-800 focus:ring-emerald-300'
                                  : 'border-slate-300 bg-white text-slate-500 focus:ring-indigo-300'
                              }`}
                              value={mapping[group.name] || ''}
                              onChange={(e) => handleMapChange(group.name, e.target.value)}
                            >
                              <option value="">-- Tidak Dipetakan --</option>
                              {clusters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.id === bestClusterId && bestScore > 0.4
                                    ? `★ ${c.name} (${confidencePct}%)`
                                    : c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Barang akan berstatus{' '}
                      <b className="text-amber-600">Menunggu Verifikasi Fisik</b> setelah diimport.
                    </p>
                    <Button
                      onClick={() => importMutation.mutate()}
                      disabled={importMutation.isPending}
                      className="bg-[#003ec7] hover:bg-[#0052ff] text-white"
                    >
                      {importMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" /> Simpan & Selesaikan Import
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Upload zone */
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3 border-slate-100 border-b pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eff4ff] text-[#003ec7]">
                      <CloudUpload className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Unggah File ASPAK</h3>
                      <p className="text-slate-500 text-xs">
                        Format <span className="font-mono">.xls</span> /{' '}
                        <span className="font-mono">.xlsx</span>, maks 10MB.
                      </p>
                    </div>
                  </div>

                  {!file ? (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                        dragOver
                          ? 'border-[#003ec7] bg-[#eff4ff]'
                          : 'border-slate-200 bg-slate-50/40 hover:border-[#c7d8ff] hover:bg-[#eff4ff]/40'
                      }`}
                    >
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#003ec7] text-white shadow">
                        <CloudUpload className="h-7 w-7" />
                      </div>
                      <p className="font-semibold text-slate-900">
                        Seret & lepas file Excel di sini
                      </p>
                      <p className="mt-1 text-slate-500 text-sm">
                        atau{' '}
                        <span className="font-medium text-[#003ec7] underline">pilih file</span>{' '}
                        dari komputer
                      </p>
                      <p className="mt-3 text-slate-400 text-xs">.xls · .xlsx · maksimal 10 MB</p>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-[#c7d8ff] bg-[#eff4ff]/60 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 text-sm">{file.name}</p>
                        <p className="text-slate-500 text-xs">{formatBytes(file.size)}</p>
                      </div>
                      {!previewMutation.isPending && !importMutation.isPending && (
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            if (fileRef.current) fileRef.current.value = '';
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xls,.xlsx"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />

                  {importMutation.isPending && (
                    <div className="mt-5 space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-slate-700">
                          <Loader2 className="h-4 w-4 animate-spin text-[#003ec7]" />
                          Memproses file ke database...
                        </span>
                        <span className="font-semibold text-[#003ec7]">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}

                  {!isMappingMode && file && !importMutation.isPending && (
                    <Button
                      onClick={() => previewMutation.mutate(file)}
                      disabled={previewMutation.isPending}
                      className="mt-5 w-full gap-2 bg-[#003ec7] text-white hover:bg-[#0052ff]"
                    >
                      {previewMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Membaca File...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" /> Lanjut ke Pemetaan Klaster
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Result */}
              {result && !isMappingMode && (
                <ImportResult result={result} expandedState={[showAllErrors, setShowAllErrors]} />
              )}
            </div>

            {/* Right: Recent imports */}
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-slate-100 border-b p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <History className="h-4 w-4 text-[#003ec7]" />
                    Import Terbaru
                  </h3>
                  <Link
                    href="/import/logs"
                    className="flex items-center gap-0.5 font-medium text-[#003ec7] text-xs hover:underline"
                  >
                    Lihat semua
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                  {!recentLogs &&
                    [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  {recentLogs && recentLogs.data.length === 0 && (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                      <FileWarning className="mx-auto mb-2 h-8 w-8" />
                      Belum ada riwayat import.
                    </div>
                  )}
                  {recentLogs?.data.map((log) => (
                    <RecentItem key={log.id} log={log} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-2.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-xs">
                    <p className="font-semibold text-amber-900">Catatan Pemetaan Baru</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-amber-800 leading-relaxed">
                      <li>Sistem tidak lagi langsung mengimpor.</li>
                      <li>Anda wajib memetakan "Kit" ke Klaster terkait.</li>
                      <li>
                        Data tersimpan akan masuk dalam antrian <b>Verifikasi Fisik</b> staf.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-9 items-center gap-2 rounded-md px-4 font-medium text-sm transition ${
        active
          ? 'bg-[#003ec7] text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge && (
        <span
          className={`ml-1 rounded border px-1.5 py-0 text-[10px] ${
            active
              ? 'border-white/30 bg-white/15 text-white'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function RecentItem({ log }: { log: ImportLogItem }) {
  const ok = log.status === 'DONE';
  const failed = log.status === 'FAILED';
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50/60">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          ok
            ? 'bg-emerald-100 text-emerald-700'
            : failed
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
        }`}
      >
        {ok ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : failed ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900 text-xs">{log.filename}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge
            className={`rounded px-1.5 py-0 font-medium text-[10px] ${
              ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : failed
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {log.status}
          </Badge>
          <span className="text-slate-400 text-[11px]">{relTime(log.created_at)}</span>
        </div>
        {typeof log.success_rows === 'number' && (
          <p className="mt-0.5 text-slate-500 text-[11px]">
            {log.success_rows} berhasil · {log.failed_rows ?? 0} gagal
          </p>
        )}
      </div>
    </div>
  );
}

function ImportResult({
  result,
  expandedState,
}: {
  result: { success: number; failed: number; errors: ImportError[] };
  expandedState: [boolean, (v: boolean) => void];
}) {
  const [expanded, setExpanded] = expandedState;
  const total = result.success + result.failed;
  const errors = result.errors ?? [];
  const visible = expanded ? errors : errors.slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3 border-slate-100 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Hasil Import</h3>
          <p className="text-slate-500 text-xs">Rangkuman proses import terakhir.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="Total Baris" value={total} accent="bg-slate-50 text-slate-900" />
        <ResultStat
          label="Berhasil"
          value={result.success}
          accent="bg-emerald-50 text-emerald-700"
        />
        <ResultStat label="Gagal" value={result.failed} accent="bg-red-50 text-red-700" />
      </div>

      {errors.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-medium text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Detail Error ({errors.length})
            </p>
            {errors.length > 5 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="font-medium text-[#003ec7] text-xs hover:underline"
              >
                {expanded ? 'Sembunyikan' : `Tampilkan semua (${errors.length})`}
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-red-100 bg-red-50/40 p-3">
            {visible.map((e, i) => (
              <div
                key={`${e.row}-${i}`}
                className="flex gap-2 rounded border border-red-100 bg-white px-2.5 py-1.5 text-xs"
              >
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-mono font-semibold text-red-700">
                  Baris {e.row}
                </span>
                <span className="flex-1 text-slate-700">{e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-lg p-3 text-center ${accent}`}>
      <p className="font-semibold text-2xl">{value}</p>
      <p className="mt-0.5 text-slate-500 text-xs">{label}</p>
    </div>
  );
}
