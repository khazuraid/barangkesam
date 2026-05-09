'use client';

import { type ActivityLogItem, LogDetailDialog } from '@/components/logs/LogDetailDialog';
import { LogTimelineRow } from '@/components/logs/LogTimelineRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CalendarDays,
  History,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type LogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORT'
  | 'EXPORT'
  | 'UPLOAD'
  | 'TOGGLE_ACTIVE'
  | 'RESET_PASSWORD';

type ActivityLogsResponse = {
  data: ActivityLogItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

const ACTION_OPTIONS: LogAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'IMPORT',
  'EXPORT',
  'UPLOAD',
  'TOGGLE_ACTIVE',
  'RESET_PASSWORD',
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-[#003ec7] border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-[#eff4ff] text-[#003ec7] border-[#c7d8ff]',
  LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
  IMPORT: 'bg-violet-50 text-violet-700 border-violet-200',
  EXPORT: 'bg-amber-50 text-amber-700 border-amber-200',
  UPLOAD: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  TOGGLE_ACTIVE: 'bg-orange-50 text-orange-700 border-orange-200',
  RESET_PASSWORD: 'bg-rose-50 text-rose-700 border-rose-200',
};

function actionClass(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function getInitials(name?: string | null) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
}

/* -------- Hero -------- */
function LogsHero({ total, todayCount }: { total: number; todayCount: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#c7d8ff]/60 bg-gradient-to-br from-[#003ec7] via-[#0052ff] to-[#2563eb] p-6 shadow-[0_20px_40px_-12px_rgba(0,62,199,0.35)] md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
      <div className="-top-24 -right-24 pointer-events-none absolute h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="-bottom-20 -left-16 pointer-events-none absolute h-48 w-48 rounded-full bg-[#6ffbbe]/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-white/80 text-xs uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Audit Trail
          </div>
          <h1 className="font-semibold text-2xl text-white tracking-tight md:text-3xl">
            Activity Logs
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Riwayat lengkap aktivitas sistem — pantau setiap aksi pengguna untuk keamanan dan
            akuntabilitas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-white/70 uppercase tracking-wider">
              <Activity className="h-3 w-3" />
              Total Log
            </div>
            <p className="font-bold font-mono text-2xl text-white md:text-3xl">
              {total.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/15 p-4 backdrop-blur-md">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-emerald-50/90 uppercase tracking-wider">
              <TrendingUp className="h-3 w-3" />
              Hari ini
            </div>
            <p className="font-bold font-mono text-2xl text-white md:text-3xl">
              {todayCount.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- Empty State -------- */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#eff4ff] to-[#dde1ff] text-[#003ec7]">
        <History className="h-9 w-9" />
      </div>
      <p className="font-semibold text-base text-slate-900">Tidak ada aktivitas</p>
      <p className="mt-1 max-w-sm text-slate-500 text-sm">
        Coba ubah filter atau kata kunci pencarian untuk melihat catatan aktivitas.
      </p>
    </div>
  );
}

export default function ActivityLogsPage() {
  const user = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<LogAction | ''>('');
  const [entityFilter, setEntityFilter] = useState('');
  const [view, setView] = useState<'feed' | 'table'>('feed');

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(entityFilter ? { entity: entityFilter } : {}),
    }),
    [page, limit, search, actionFilter, entityFilter],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['activity-logs', queryParams],
    queryFn: async () => {
      const r = await api.get('/activity-logs', { params: queryParams });
      return r.data.data as ActivityLogsResponse;
    },
    enabled: user?.role === 'ADMIN',
  });

  const [openDetail, setOpenDetail] = useState<ActivityLogItem | null>(null);

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter((l) => new Date(l.created_at).toDateString() === today).length;
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity));
    return Array.from(set);
  }, [logs]);

  const applySearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchInput('');
    setActionFilter('');
    setEntityFilter('');
    setPage(1);
  };

  /* -------- Non-admin guard -------- */
  if (user?.role !== 'ADMIN') {
    return (
      <div>
        <div className="mx-auto max-w-xl p-6">
          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-8 text-center shadow-[0_8px_30px_-8px_rgba(245,158,11,0.25)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="font-semibold text-amber-900 text-lg">Akses Terbatas</h2>
            <p className="mt-2 text-amber-800/80 text-sm">
              Halaman ini hanya dapat diakses oleh Administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6 p-6">
        <LogsHero total={total} todayCount={todayCount} />

        {/* Filter Bar (Glass Pill) */}
        <div className="sticky top-4 z-20 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_8px_30px_-8px_rgba(0,62,199,0.12)] backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {/* Search */}
            <div className="relative md:col-span-5">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="Cari deskripsi, entitas..."
                className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-sm focus:border-[#003ec7] focus:ring-2 focus:ring-[#003ec7]/15"
              />
            </div>

            {/* Action */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value as LogAction | '');
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-slate-700 text-sm focus:border-[#003ec7] focus:outline-none focus:ring-2 focus:ring-[#003ec7]/15 md:col-span-2"
            >
              <option value="">Semua Aksi</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {/* Entity */}
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-slate-700 text-sm focus:border-[#003ec7] focus:outline-none focus:ring-2 focus:ring-[#003ec7]/15 md:col-span-2"
            >
              <option value="">Semua Entitas</option>
              {uniqueEntities.map((en) => (
                <option key={en} value={en}>
                  {en}
                </option>
              ))}
            </select>

            {/* Actions */}
            <div className="flex items-center gap-2 md:col-span-3 md:justify-end">
              <Button
                variant="outline"
                onClick={applySearch}
                className="h-10 rounded-xl border-slate-200 px-3"
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Cari
              </Button>
              <Button
                variant="outline"
                onClick={resetFilters}
                className="h-10 rounded-xl border-slate-200 px-3"
                title="Reset filter"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-10 rounded-xl bg-[#003ec7] px-3 text-white hover:bg-[#0052ff]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* View Toggle & Active Filters */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-slate-100 border-t pt-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff4ff] px-2.5 py-1 text-[#003ec7]">
                  Cari: "{search}"
                </span>
              )}
              {actionFilter && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${actionClass(actionFilter)}`}
                >
                  Aksi: {actionFilter}
                </span>
              )}
              {entityFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  Entitas: {entityFilter}
                </span>
              )}
              {!search && !actionFilter && !entityFilter && (
                <span className="text-slate-400">Tidak ada filter aktif</span>
              )}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setView('feed')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition ${
                  view === 'feed'
                    ? 'bg-white text-[#003ec7] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Feed
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition ${
                  view === 'table'
                    ? 'bg-white text-[#003ec7] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Tabel
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {['sk1', 'sk2', 'sk3', 'sk4', 'sk5'].map((k) => (
              <Skeleton key={k} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-8px_rgba(0,62,199,0.08)]">
            <EmptyState />
          </div>
        ) : view === 'feed' ? (
          /* FEED VIEW */
          <ul className="relative space-y-0">
            {logs.map((log, idx) => (
              <LogTimelineRow
                key={log.id}
                log={log}
                isLast={idx === logs.length - 1}
                onOpen={setOpenDetail}
              />
            ))}
          </ul>
        ) : (
          /* TABLE VIEW */
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-8px_rgba(0,62,199,0.08)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium">Waktu</th>
                    <th className="px-5 py-3 text-left font-medium">Aksi</th>
                    <th className="px-5 py-3 text-left font-medium">Entitas</th>
                    <th className="px-5 py-3 text-left font-medium">Deskripsi</th>
                    <th className="px-5 py-3 text-left font-medium">User</th>
                    <th className="w-12 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="group hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 align-top">
                        <p className="font-medium text-slate-700 text-xs">
                          {timeAgo(log.created_at)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          <CalendarDays className="mr-0.5 inline h-3 w-3" />
                          {formatDateTime(log.created_at)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-[11px] ${actionClass(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                          {log.entity}
                        </span>
                      </td>
                      <td className="max-w-md px-5 py-3.5 align-top">
                        <p className="line-clamp-2 text-slate-700 text-sm">
                          {log.description ?? <span className="text-slate-400 italic">-</span>}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#003ec7] font-semibold text-[10px] text-white">
                              {getInitials(log.user.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 text-xs">
                                {log.user.name}
                              </p>
                              <p className="truncate text-[10px] text-slate-400">{log.user.role}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">System</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right align-top">
                        <button
                          type="button"
                          onClick={() => setOpenDetail(log)}
                          aria-label={`Lihat detail log ${log.action} ${log.entity}`}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 opacity-60 transition hover:bg-[#eff4ff] hover:text-[#003ec7] hover:opacity-100 focus:bg-[#eff4ff] focus:text-[#003ec7] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#003ec7]/30 group-hover:bg-[#eff4ff] group-hover:text-[#003ec7] group-hover:opacity-100"
                        >
                          →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination (Glass Pill) */}
        {meta && meta.totalPages > 0 && logs.length > 0 && (
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-[0_8px_30px_-8px_rgba(0,62,199,0.12)] backdrop-blur-xl">
            <div className="flex items-center gap-3 text-slate-600 text-xs">
              <span>
                Menampilkan{' '}
                <span className="font-semibold text-slate-800">
                  {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)}
                </span>{' '}
                dari <span className="font-semibold text-slate-800">{meta.total}</span>
              </span>
              <span className="h-3 w-px bg-slate-200" />
              <label className="flex items-center gap-1.5">
                <span className="text-slate-500">Per halaman:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs focus:border-[#003ec7] focus:outline-none"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Sebelumnya
              </Button>
              <span className="rounded-lg bg-[#eff4ff] px-3 py-1 font-semibold text-[#003ec7] text-xs">
                {meta.page} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Berikutnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(meta.totalPages)}
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                »
              </Button>
            </div>
          </div>
        )}
      </div>

      <LogDetailDialog log={openDetail} onClose={() => setOpenDetail(null)} />
    </div>
  );
}
