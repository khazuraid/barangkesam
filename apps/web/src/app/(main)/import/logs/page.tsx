'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type ImportLogItem = {
  id: string;
  filename: string;
  type: string;
  status: 'DONE' | 'FAILED' | 'PROCESSING' | string;
  total_rows: number | null;
  success_rows: number | null;
  failed_rows: number | null;
  errors?: { row: number; error: string }[] | null;
  created_at: string;
  faskes?: { nama: string; kode_rs: string } | null;
  creator?: { name: string; email?: string } | null;
};

type ImportLogsResponse = {
  data: ImportLogItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relTime(iso: string) {
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

function statusBadge(status: string) {
  if (status === 'DONE')
    return {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  if (status === 'FAILED')
    return {
      cls: 'border-red-200 bg-red-50 text-red-700',
      icon: <XCircle className="h-3 w-3" />,
    };
  return {
    cls: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
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
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ImportLogsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'DONE' | 'FAILED' | 'PROCESSING'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">
          Maaf, Anda tidak memiliki izin untuk mengakses halaman Riwayat Import. Fitur ini hanya tersedia untuk Administrator.
        </p>
      </div>
    );
  }

  const [openDetail, setOpenDetail] = useState<ImportLogItem | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<ImportLogsResponse>({
    queryKey: ['import-logs', page, q, status, from, to],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (q) params.q = q;
      if (status) params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const r = await api.get('/import/logs', { params });
      return r.data.data as ImportLogsResponse;
    },
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const stats = useMemo(() => {
    const total = meta?.total ?? 0;
    const sukses = logs.filter((l) => l.status === 'DONE').length;
    const gagal = logs.filter((l) => l.status === 'FAILED').length;
    const totalRows = logs.reduce((a, l) => a + (l.total_rows ?? 0), 0);
    return { total, sukses, gagal, totalRows };
  }, [logs, meta]);

  const resetFilters = () => {
    setQ('');
    setStatus('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">
              Riwayat Import Data
            </h2>
            <p className="mt-1 text-slate-500 text-sm">
              Pantau seluruh aktivitas import data Excel ASPAK.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/import">
              <Button variant="outline" className="h-10 gap-2">
                <UploadCloud className="h-4 w-4" />
                Import Baru
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-10 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Import"
            value={stats.total}
            icon={FileSpreadsheet}
            accent="bg-[#eff4ff] text-[#003ec7]"
          />
          <StatCard
            label="Sukses (Halaman)"
            value={stats.sukses}
            icon={CheckCircle2}
            accent="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Gagal (Halaman)"
            value={stats.gagal}
            icon={XCircle}
            accent="bg-red-50 text-red-700"
          />
          <StatCard
            label="Total Baris"
            value={stats.totalRows}
            icon={AlertTriangle}
            accent="bg-violet-50 text-violet-700"
          />
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_160px_140px_140px_auto]">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama file..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="h-10 pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setPage(1);
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/20"
            >
              <option value="">Semua Status</option>
              <option value="DONE">Sukses</option>
              <option value="FAILED">Gagal</option>
              <option value="PROCESSING">Proses</option>
            </select>
            <div className="relative">
              <Calendar className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="h-10 pl-9"
              />
            </div>
            <div className="relative">
              <Calendar className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="h-10 pl-9"
              />
            </div>
            <Button variant="outline" onClick={resetFilters} className="h-10 gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">File</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Hasil</th>
                  <th className="px-6 py-3 font-medium" />
                  <th className="px-6 py-3 font-medium">Oleh</th>
                  <th className="px-6 py-3 font-medium">Waktu</th>
                  <th className="px-6 py-3 text-right font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading &&
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={`sk-row-${i}`}>
                      {['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((c) => (
                        <td key={`sk-${i}-${c}`} className="px-6 py-4">
                          <Skeleton className="h-3 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!isLoading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500 text-sm">
                      <CircleAlert className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      <p className="font-medium text-slate-700">Belum ada riwayat import</p>
                      <p className="mt-1 text-xs">
                        Mulai import file ASPAK pertama Anda untuk melihat riwayatnya di sini.
                      </p>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  logs.map((log) => {
                    const sb = statusBadge(log.status);
                    const total = log.total_rows ?? 0;
                    const ok = log.success_rows ?? 0;
                    const fail = log.failed_rows ?? 0;
                    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
                    return (
                      <tr key={log.id} className="group transition-colors hover:bg-slate-50/60">
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                              <FileSpreadsheet className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 text-sm">
                                {log.filename}
                              </p>
                              <p className="text-slate-400 text-xs">
                                {total} baris · {log.type}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Badge
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-xs ${sb.cls}`}
                          >
                            {sb.icon}
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="min-w-[140px]">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-emerald-700">{ok}</span>
                              <span className="text-slate-400">berhasil</span>
                              <span className="text-slate-300">·</span>
                              <span className="font-medium text-red-700">{fail}</span>
                              <span className="text-slate-400">gagal</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {log.faskes ? (
                            <div>
                              <p className="font-medium text-slate-900 text-sm">
                                {log.faskes.nama}
                              </p>
                              <p className="font-mono text-slate-400 text-xs">
                                {log.faskes.kode_rs}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          {log.creator ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003ec7] font-medium text-white text-[10px]">
                                {getInitials(log.creator.name)}
                              </div>
                              <span className="truncate text-slate-700 text-sm">
                                {log.creator.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">System</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 text-xs">
                              {relTime(log.created_at)}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setOpenDetail(log)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 opacity-70 transition hover:bg-slate-100 hover:text-[#003ec7] group-hover:opacity-100"
                              title="Lihat detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {meta && logs.length > 0 && (
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

      {/* Detail Dialog */}
      <Dialog open={!!openDetail} onOpenChange={(o) => !o && setOpenDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#003ec7]" />
              Detail Import
            </DialogTitle>
          </DialogHeader>
          {openDetail && (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="File">
                  <p className="truncate font-medium text-slate-900 text-sm">
                    {openDetail.filename}
                  </p>
                </InfoTile>
                <InfoTile label="Status">
                  <Badge
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-xs ${statusBadge(openDetail.status).cls}`}
                  >
                    {openDetail.status}
                  </Badge>
                </InfoTile>
                <InfoTile label="Waktu">
                  <p className="text-slate-900 text-sm">{formatDateTime(openDetail.created_at)}</p>
                </InfoTile>
                <InfoTile label="Tipe">
                  <p className="font-mono text-slate-900 text-sm">{openDetail.type}</p>
                </InfoTile>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ResultStat
                  label="Total"
                  value={openDetail.total_rows ?? 0}
                  accent="bg-slate-50 text-slate-900"
                />
                <ResultStat
                  label="Berhasil"
                  value={openDetail.success_rows ?? 0}
                  accent="bg-emerald-50 text-emerald-700"
                />
                <ResultStat
                  label="Gagal"
                  value={openDetail.failed_rows ?? 0}
                  accent="bg-red-50 text-red-700"
                />
              </div>

              {openDetail.faskes && (
                <InfoTile label="Faskes">
                  <p className="font-medium text-slate-900 text-sm">{openDetail.faskes.nama}</p>
                  <p className="font-mono text-slate-400 text-xs">{openDetail.faskes.kode_rs}</p>
                </InfoTile>
              )}

              {openDetail.creator && (
                <InfoTile label="Diimpor oleh">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#003ec7] font-medium text-white text-xs">
                      {getInitials(openDetail.creator.name)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {openDetail.creator.name}
                      </p>
                      {openDetail.creator.email && (
                        <p className="text-slate-500 text-xs">{openDetail.creator.email}</p>
                      )}
                    </div>
                  </div>
                </InfoTile>
              )}

              {openDetail.errors && openDetail.errors.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 font-medium text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Detail Error ({openDetail.errors.length})
                  </p>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-red-100 bg-red-50/40 p-3">
                    {openDetail.errors.map((e, i) => (
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
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="mb-1 text-slate-500 text-xs uppercase tracking-wide">{label}</p>
      {children}
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
