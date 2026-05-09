'use client';

import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthHydrated, useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  MapPin,
  Plus,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'FULFILLED';

type EquipmentRequestRow = {
  id: string;
  request_no: string;
  nama_alat: string;
  quantity: number;
  status: RequestStatus;
  created_at: string;
  submitted_at?: string | null;
  requester?: { id: string; name: string; email: string; role?: string } | null;
  group?: { id: string; name: string; level: number } | null;
};

type PaginatedResponse<T> = {
  success?: boolean;
  data?: { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number };
  items?: T[];
  total?: number;
  page?: number;
  limit?: number;
};

const STATUS_OPTIONS: { value: '' | RequestStatus; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
  { value: 'FULFILLED', label: 'Terpenuhi' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatDate(input?: string | null) {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PengajuanPage() {
  const hydrated = useAuthHydrated();
  const role = useAuthStore((s) => s.user?.role);
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['requests', 'list', status, search, fromDate, toDate, sortBy, order],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '500');
      if (status) params.set('status', status);
      if (search) params.set('q', search);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      if (sortBy) params.set('sort_by', sortBy);
      if (order) params.set('order', order);

      for (const endpoint of [
        `/requests?${params.toString()}`,
        `/equipment-requests?${params.toString()}`,
      ]) {
        try {
          const res = await api.get<PaginatedResponse<EquipmentRequestRow>>(endpoint);
          const body = res.data;
          const items = Array.isArray(body?.data)
            ? body.data
            : (body?.data?.items ?? body?.data?.data ?? body?.items ?? []);
          if (Array.isArray(items)) return items as EquipmentRequestRow[];
        } catch {
          /* fallback */
        }
      }
      return [] as EquipmentRequestRow[];
    },
    enabled: hydrated,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      [r.request_no, r.nama_alat, r.group?.name ?? '', r.requester?.name ?? '', r.status]
        .join(' ')
        .toLowerCase()
        .includes(kw),
    );
  }, [rows, search]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === 'PENDING').length,
      approved: rows.filter((r) => r.status === 'APPROVED').length,
      rejected: rows.filter((r) => r.status === 'REJECTED').length,
    }),
    [rows],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('asc');
    }
  };

  const hasFilter =
    status !== '' ||
    search !== '' ||
    fromDate !== '' ||
    toDate !== '' ||
    sortBy !== 'created_at' ||
    order !== 'desc';

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 pt-6 pb-5 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Daftar Pengajuan</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium max-w-xl">
              Kelola dan pantau status permintaan alat kesehatan per ruangan dengan mudah.
            </p>
          </div>
          <Link href="/pengajuan/baru">
            <Button className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl px-5 font-bold gap-2">
              <Plus className="w-4 h-4" />
              Buat Pengajuan Baru
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mt-6 space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Pengajuan',
              value: stats.total,
              icon: FileSpreadsheet,
              color: 'text-slate-700',
              bg: 'bg-slate-100',
              card: 'border-slate-200',
            },
            {
              label: 'Menunggu Review',
              value: stats.pending,
              icon: Clock,
              color: 'text-amber-700',
              bg: 'bg-amber-100',
              card: 'border-amber-200',
            },
            {
              label: 'Disetujui',
              value: stats.approved,
              icon: CheckCircle,
              color: 'text-emerald-700',
              bg: 'bg-emerald-100',
              card: 'border-emerald-200',
            },
            {
              label: 'Ditolak',
              value: stats.rejected,
              icon: XCircle,
              color: 'text-rose-700',
              bg: 'bg-rose-100',
              card: 'border-rose-200',
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={`bg-white border ${s.card} rounded-2xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group hover:shadow-md transition-shadow`}
              >
                <div
                  className={`absolute -right-3 -top-3 w-20 h-20 ${s.bg} rounded-full opacity-30 group-hover:scale-150 transition-transform duration-500`}
                />
                <div className={`p-3 ${s.bg} rounded-xl relative z-10`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {s.label}
                  </p>
                  <p className={`text-2xl font-extrabold ${s.color} mt-0.5`}>
                    {isLoading ? '–' : s.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Role */}
        {role !== 'ADMIN' && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-800 text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            Data pengajuan ditampilkan sesuai akses role dan ruangan Anda.
          </div>
        )}

        {/* Table Card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari ID, nama alat, atau ruangan..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white font-medium transition-all"
                />
              </div>

              {/* Date Range Group — Modern & Unified Design */}
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 h-10 group focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-transparent transition-all shrink-0 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-[11px] font-bold text-slate-700 p-0 w-[105px] cursor-pointer"
                  />
                  <div className="h-4 w-px bg-slate-200 mx-1" /> {/* Thin Vertical Separator */}
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-[11px] font-bold text-slate-700 p-0 w-[105px] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Select
                  value={status || 'all'}
                  onValueChange={(v) => {
                    setStatus(v === 'all' ? '' : (v ?? ''));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-36 rounded-xl border-slate-200 text-xs font-semibold bg-white shrink-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Semua Status</SelectItem>
                    {STATUS_OPTIONS.filter((o) => o.value !== '').map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('');
                      setSearch('');
                      setFromDate('');
                      setToDate('');
                      setSortBy('created_at');
                      setOrder('desc');
                      setPage(1);
                    }}
                    className="h-10 px-3 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => refetch()}
                  className="h-10 px-3 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-0 text-sm">
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
                      Nama Alat
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
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell w-32">
                    Ruangan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell w-28">
                    Dibuat Oleh
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
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell w-28">
                    Tanggal
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
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <tr key={i}>
                      {[100, 200, 140, 100, 40, 90, 100, 30].map((w, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                        <td key={j} className="px-4 py-3.5">
                          <Skeleton className={'h-4 rounded'} style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500 text-base">
                        Tidak ada pengajuan ditemukan
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        {hasFilter
                          ? 'Coba ubah atau reset filter'
                          : 'Belum ada pengajuan yang dibuat'}
                      </p>
                      {hasFilter && (
                        <button
                          type="button"
                          onClick={() => {
                            setStatus('');
                            setSearch('');
                            setPage(1);
                          }}
                          className="mt-4 px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                        >
                          Reset Filter
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageData.map((row) => (
                    <tr
                      key={row.id}
                      title="Klik 2x untuk membuka detail"
                      className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                      onDoubleClick={() => router.push(`/pengajuan/${row.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 font-semibold">
                        {row.request_no}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-700 transition-colors">
                          {row.nama_alat}
                        </p>
                        <p className="text-[10px] text-indigo-600 font-semibold sm:hidden mt-0.5">
                          {row.group?.name ?? '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {row.group ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{row.group.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/60 flex items-center justify-center text-[9px] font-extrabold text-indigo-700 shrink-0">
                            {row.requester?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[80px]">
                            {row.requester?.name ?? '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200">
                          {row.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs font-semibold text-slate-600">
                          {formatDate(row.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RequestStatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/pengajuan/${row.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && filtered.length > 0 && (
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
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>{' '}
                  baris per halaman
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="hidden sm:inline">
                  Menampilkan <strong className="text-slate-700">{start + 1}</strong>–
                  <strong className="text-slate-700">
                    {Math.min(start + pageSize, filtered.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-700">{filtered.length}</strong> entri
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
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (safePage <= 3) {
                    pageNum = i + 1;
                  } else if (safePage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = safePage - 2 + i;
                  }
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
