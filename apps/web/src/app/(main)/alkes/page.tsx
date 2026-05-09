'use client';
import { AlkesConditionBadge } from '@/components/alkes/AlkesConditionBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationBadge } from '@/components/verification/VerificationBadge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { AlkesItem } from '@/types/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Plus,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function AlkesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isManagerOrStaff = user?.role === 'MANAGER' || user?.role === 'STAFF';
  const userRoomName = user?.assigned_room?.name ?? null;
  const userRoomId = user?.assigned_room_id ?? null;

  const qc = useQueryClient();
  const [berfungsi, setBerfungsi] = useState('');
  const [vStatus, setVStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fromDate, _setFromDate] = useState('');
  const [toDate, _setToDate] = useState('');
  const [sortBy, setSortBy] = useState('nama_alat');
  const [order, setOrder] = useState('asc');

  const {
    data: rawData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['alkes-list', berfungsi, vStatus, fromDate, toDate, sortBy, order],
    queryFn: () =>
      api
        .get('/alkes', {
          params: {
            berfungsi: berfungsi || undefined,
            verification_status: vStatus || undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            sort_by: sortBy || undefined,
            order: order || undefined,
            page: 1,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  // API returns: { success: true, data: { data: [], total, page, ... } }
  const alkes: AlkesItem[] = (rawData?.data?.data as AlkesItem[] | undefined) ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return alkes;
    const q = search.toLowerCase();
    return alkes.filter(
      (a) =>
        a.nama_alat?.toLowerCase().includes(q) ||
        a.kode_alat?.toLowerCase().includes(q) ||
        a.no_seri?.toLowerCase().includes(q) ||
        a.merk?.toLowerCase().includes(q) ||
        a.group?.name?.toLowerCase().includes(q),
    );
  }, [alkes, search]);

  const stats = useMemo(
    () => ({
      total: alkes.length,
      baik: alkes.filter((a) => a.berfungsi === 'Baik').length,
      rusak: alkes.filter((a) => a.berfungsi === 'Rusak' || a.berfungsi === 'tdk berfungsi').length,
      pending: alkes.filter((a) => a.verification_status === 'PENDING').length,
    }),
    [alkes],
  );

  const hasFilter = !!(
    berfungsi ||
    vStatus ||
    search ||
    fromDate ||
    toDate ||
    sortBy !== 'nama_alat' ||
    order !== 'asc'
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  // Sort handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('asc');
    }
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string | null) => {
    setter(v === 'all' || !v ? '' : v);
    setPage(1);
  };

  const bulkDeleteMut = useMutation({
    mutationFn: () => api.post('/alkes/bulk-delete', { alkes_ids: selectedIds }),
    onSuccess: () => {
      import('sonner').then((m) =>
        m.toast.success(`Berhasil menghapus ${selectedIds.length} aset.`),
      );
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['alkes-list'] });
      refetch();
    },
    onError: (e: any) =>
      import('sonner').then((m) =>
        m.toast.error(e.response?.data?.error || 'Gagal menghapus aset'),
      ),
    onSettled: () => setIsBulkDeleting(false),
  });

  const handleBulkDelete = () => {
    if (
      confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} aset terpilih secara permanen?`,
      )
    ) {
      setIsBulkDeleting(true);
      bulkDeleteMut.mutate();
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((a) => a.id));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 pt-6 pb-5 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Daftar Aset Alkes
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-medium max-w-xl">
              Inventaris peralatan medis. Pantau ketersediaan, kondisi, dan status verifikasi.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <Link href="/kelompok/alkes">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 font-semibold text-slate-700 gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Kelola Kelompok
                  </Button>
                </Link>
                <Link href="/alkes/new">
                  <Button className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl px-5 font-bold gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah Aset
                  </Button>
                </Link>
              </>
            )}
            {!isAdmin && (
              <Link href="/alkes/new">
                <Button className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl px-5 font-bold gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah Aset
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mt-6 space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Aset',
              value: stats.total,
              icon: Archive,
              color: 'text-slate-700',
              bg: 'bg-slate-100',
              card: 'border-slate-200',
            },
            {
              label: 'Kondisi Baik',
              value: stats.baik,
              icon: CheckCircle,
              color: 'text-emerald-700',
              bg: 'bg-emerald-100',
              card: 'border-emerald-200',
            },
            {
              label: 'Perlu Perhatian',
              value: stats.rusak,
              icon: AlertCircle,
              color: 'text-rose-700',
              bg: 'bg-rose-100',
              card: 'border-rose-200',
            },
            {
              label: 'Belum Diverifikasi',
              value: stats.pending,
              icon: Activity,
              color: 'text-amber-700',
              bg: 'bg-amber-100',
              card: 'border-amber-200',
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

        {/* Staff room info */}
        {isManagerOrStaff && (
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl border text-sm font-semibold ${userRoomId ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
          >
            {userRoomId ? (
              <>
                <MapPin className="w-4 h-4" /> Akses terbatas ke ruangan:{' '}
                <span className="font-bold">{userRoomName}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" /> Akun belum memiliki ruangan — hubungi Admin
              </>
            )}
          </div>
        )}

        {/* Filters + Table */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search — flex-1 */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari alat, kode, no. seri, atau merk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white font-medium transition-all"
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-2 shrink-0">
                <Select value={berfungsi || 'all'} onValueChange={handleFilterChange(setBerfungsi)}>
                  <SelectTrigger className="h-10 w-[140px] rounded-xl border-slate-200 text-xs font-semibold bg-white">
                    <SelectValue placeholder="Kondisi" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Kondisi</SelectItem>
                    <SelectItem value="Baik">🟢 Baik</SelectItem>
                    <SelectItem value="Rusak">🔴 Rusak</SelectItem>
                    <SelectItem value="tdk beroperasi">🟠 Tdk Beroperasi</SelectItem>
                    <SelectItem value="tdk berfungsi">⚫ Tdk Berfungsi</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={vStatus || 'all'} onValueChange={handleFilterChange(setVStatus)}>
                  <SelectTrigger className="h-10 w-[140px] rounded-xl border-slate-200 text-xs font-semibold bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Status</SelectItem>
                    <SelectItem value="PENDING">⏳ Menunggu</SelectItem>
                    <SelectItem value="APPROVED">✅ Disetujui</SelectItem>
                    <SelectItem value="REJECTED">❌ Ditolak</SelectItem>
                    <SelectItem value="DRAFT">📝 Draft</SelectItem>
                  </SelectContent>
                </Select>

                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setBerfungsi('');
                      setVStatus('');
                      setSearch('');
                      setSortBy('nama_alat');
                      setOrder('asc');
                    }}
                    className="h-10 px-3 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Bulk delete bar */}
            {selectedIds.length > 0 && (isAdmin || user?.role === 'MANAGER') && (
              <div className="flex items-center gap-3 mt-3 animate-in fade-in slide-in-from-top-2 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200">
                <span className="text-sm font-bold text-rose-800 flex-1">
                  {selectedIds.length} aset terpilih
                </span>
                <Button
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white h-8 rounded-lg shadow-sm gap-1.5"
                >
                  {isBulkDeleting ? (
                    'Menghapus...'
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" /> Hapus Terpilih
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-0 text-sm table-fixed">
              <colgroup>
                <col className="w-12" />
                <col className="w-14" />
                <col className="w-auto" />
                <col className="w-36 hidden sm:table-column" />
                <col className="w-32 hidden md:table-column" />
                <col className="w-32" />
                <col className="w-28 hidden sm:table-column" />
                <col className="w-20" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 accent-indigo-600 w-4 h-4"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3" />
                  <th
                    className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('nama_alat')}
                  >
                    <div className="flex items-center gap-1">
                      Aset
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
                  <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Ruangan
                  </th>
                  <th
                    className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('merk')}
                  >
                    <div className="flex items-center gap-1">
                      Merk / Type
                      {sortBy === 'merk' ? (
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
                    className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('berfungsi')}
                  >
                    <div className="flex items-center gap-1">
                      Kondisi
                      {sortBy === 'berfungsi' ? (
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
                    className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => handleSort('verification_status')}
                  >
                    <div className="flex items-center gap-1">
                      Verifikasi
                      {sortBy === 'verification_status' ? (
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
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`alkes-skel-${i}`}>
                      <td className="px-3 py-3.5">
                        <Skeleton className="h-4 w-4 rounded" />
                      </td>
                      {[14, 200, 140, 120, 80, 100, 60].map((w, j) => (
                        <td key={j} className="px-3 py-3.5">
                          <Skeleton className={`h-4 w-[${w}px] rounded`} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Activity className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500 text-base">
                        Tidak ada aset ditemukan
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        {hasFilter
                          ? 'Coba ubah atau reset filter di atas'
                          : 'Belum ada aset yang terdaftar'}
                      </p>
                      {hasFilter && (
                        <button
                          onClick={() => {
                            setBerfungsi('');
                            setVStatus('');
                            setSearch('');
                          }}
                          className="mt-4 px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                        >
                          Reset Filter
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageData.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/40' : ''}`}
                        onClick={() => router.push(`/alkes/${item.id}`)}
                      >
                        {/* Checkbox */}
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 accent-indigo-600 w-4 h-4 cursor-pointer"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleSelect(item.id, e as unknown as React.MouseEvent)
                            }
                          />
                        </td>
                        {/* Foto */}
                        <td className="px-3 py-2.5">
                          {item.image_url ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                              <img
                                src={item.image_url}
                                alt={item.nama_alat}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </td>
                        {/* Nama + Kode */}
                        <td className="px-3 py-2.5 overflow-hidden">
                          <p className="font-bold text-slate-900 truncate text-sm">
                            {item.nama_alat}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                            {item.kode_alat}
                          </p>
                          {/* Ruangan inline mobile */}
                          {item.group && (
                            <p className="text-[10px] text-indigo-600 font-semibold truncate mt-0.5 sm:hidden">
                              {item.group.name}
                            </p>
                          )}
                        </td>
                        {/* Ruangan — hidden on mobile */}
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          {item.group ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.group.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        {/* Merk / Type — hidden on tablet */}
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <p className="text-slate-700 font-semibold text-xs truncate">
                            {item.merk ?? '—'}
                          </p>
                          <p className="text-slate-400 text-[11px] truncate">{item.type ?? '—'}</p>
                        </td>
                        {/* Kondisi */}
                        <td className="px-3 py-2.5">
                          <AlkesConditionBadge condition={item.berfungsi} short />
                        </td>
                        {/* Verifikasi — hidden on mobile */}
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          {item.verification_status ? (
                            <VerificationBadge status={item.verification_status} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        {/* Aksi */}
                        <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/alkes/${item.id}`}>
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
                    );
                  })
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
                    {Math.min(start + pageSize, filtered.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-700">{filtered.length}</strong> aset
                </span>
                {selectedIds.length > 0 && (
                  <span className="text-indigo-600 font-bold">{selectedIds.length} dipilih</span>
                )}
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
