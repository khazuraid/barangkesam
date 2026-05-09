'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VerificationBadge } from '@/components/verification/VerificationBadge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { AlkesItem, VerificationStatusValue } from '@/types/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function VerifikasiAlkesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [status, setStatus] = useState<VerificationStatusValue>('PENDING');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role === 'STAFF') setStatus('PENDING');
  }, [user]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['verifikasi', 'alkes', status],
    queryFn: () =>
      api
        .get('/alkes', {
          params: { verification_status: status, page: 1, limit: 500 },
        })
        .then((r) => r.data.data),
    enabled: !!user,
  });

  // Fetch all statuses for progress overview (admin)
  const { data: allData } = useQuery({
    queryKey: ['verifikasi', 'alkes', 'all-stats'],
    queryFn: () =>
      Promise.all([
        api
          .get('/alkes', { params: { verification_status: 'PENDING', page: 1, limit: 500 } })
          .then((r) => r.data.data),
        api
          .get('/alkes', { params: { verification_status: 'APPROVED', page: 1, limit: 500 } })
          .then((r) => r.data.data),
        api
          .get('/alkes', { params: { verification_status: 'REJECTED', page: 1, limit: 500 } })
          .then((r) => r.data.data),
      ]),
    enabled: !!user && user.role === 'ADMIN',
    staleTime: 30_000,
  });

  const alkes: AlkesItem[] = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return alkes;
    const q = search.toLowerCase();
    return alkes.filter(
      (a) =>
        a.nama_alat?.toLowerCase().includes(q) ||
        a.kode_alat?.toLowerCase().includes(q) ||
        a.group?.name?.toLowerCase().includes(q),
    );
  }, [alkes, search]);

  // Group-level progress (Fase 3 plan)
  const groupProgress = useMemo(() => {
    if (!allData) return [];
    const [pending, approved, rejected] = allData;
    const pendingList: AlkesItem[] = pending?.data ?? [];
    const approvedList: AlkesItem[] = approved?.data ?? [];
    const rejectedList: AlkesItem[] = rejected?.data ?? [];

    const groups = new Map<
      string,
      { name: string; pending: number; approved: number; rejected: number }
    >();
    for (const item of [...pendingList, ...approvedList, ...rejectedList]) {
      const gid = item.group?.id ?? 'none';
      const gname = item.group?.name ?? 'Tanpa Kelompok';
      if (!groups.has(gid)) groups.set(gid, { name: gname, pending: 0, approved: 0, rejected: 0 });
      const g = groups.get(gid)!;
      if (pendingList.find((x) => x.id === item.id)) g.pending++;
      else if (approvedList.find((x) => x.id === item.id)) g.approved++;
      else if (rejectedList.find((x) => x.id === item.id)) g.rejected++;
    }
    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        total: g.pending + g.approved + g.rejected,
        pct:
          g.pending + g.approved + g.rejected > 0
            ? Math.round(((g.approved + g.rejected) / (g.pending + g.approved + g.rejected)) * 100)
            : 100,
      }))
      .sort((a, b) => a.pct - b.pct); // show least verified first
  }, [allData]);

  const bulkVerifyMutation = useMutation({
    mutationFn: (args: { status: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api.post('/alkes/verify/bulk', {
        alkes_ids: selectedIds,
        status: args.status,
        note: args.note,
      }),
    onSuccess: () => {
      toast.success(`Berhasil memverifikasi ${selectedIds.length} item.`);
      setSelectedIds([]);
      setShowRejectModal(false);
      setRejectNote('');
      queryClient.invalidateQueries({ queryKey: ['verifikasi', 'alkes'] });
      refetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Terjadi kesalahan.'),
    onSettled: () => setIsBulkActioning(false),
  });

  const resolveMutation = useMutation({
    mutationFn: (alkesId: string) => api.post(`/alkes/${alkesId}/resolve`),
    onSuccess: (_, alkesId) => {
      toast.success('Laporan diterima — aset ditandai Sesuai.');
      queryClient.invalidateQueries({ queryKey: ['verifikasi', 'alkes'] });
      queryClient.invalidateQueries({ queryKey: ['alkes-detail', alkesId] });
      refetch();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gagal menyelesaikan laporan.'),
  });

  const handleBulkApprove = () => {
    if (!selectedIds.length) return;
    setIsBulkActioning(true);
    bulkVerifyMutation.mutate({ status: 'APPROVED' });
  };

  const confirmReject = () => {
    if (!rejectNote.trim()) {
      toast.error('Catatan wajib diisi.');
      return;
    }
    setIsBulkActioning(true);
    bulkVerifyMutation.mutate({ status: 'REJECTED', note: rejectNote });
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((a) => a.id));

  const statItems = [
    {
      label: 'Menunggu',
      value: alkes.filter((a) => a.verification_status === 'PENDING').length,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Disetujui',
      value: alkes.filter((a) => a.verification_status === 'APPROVED').length,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Ditolak',
      value: alkes.filter((a) => a.verification_status === 'REJECTED').length,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 pt-8 pb-6 px-6 lg:px-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Verifikasi Fisik Aset
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-medium max-w-2xl">
              {user.role === 'ADMIN'
                ? 'Pantau progres verifikasi per-kelompok ruangan dan selesaikan ketidaksesuaian data (Discrepancy).'
                : 'Lakukan audit fisik pada barang PENDING. Tandai sesuai atau laporkan ketidaksesuaian.'}
            </p>
          </div>

          {/* Stat chips */}
          <div className="flex gap-3 flex-wrap">
            {statItems.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${s.bg} ${s.border} shadow-sm`}
              >
                <span className={`text-2xl font-extrabold ${s.color}`}>
                  {isLoading ? '–' : s.value}
                </span>
                <span className="text-xs font-semibold text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-6 space-y-5">
        {/* Admin: Progress per kelompok (Fase 3) */}
        {user.role === 'ADMIN' && groupProgress.length > 0 && (
          <section className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Progres Verifikasi per Kelompok
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Kelompok dengan progres terendah ditampilkan pertama.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupProgress.slice(0, 6).map((g) => (
                <div
                  key={g.name}
                  className="p-4 border border-slate-200 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all bg-slate-50/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-800 text-sm truncate max-w-[70%]">
                      {g.name}
                    </p>
                    <span
                      className={`text-sm font-extrabold ${g.pct === 100 ? 'text-emerald-600' : g.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}
                    >
                      {g.pct}%
                    </span>
                  </div>
                  <Progress value={g.pct} className="h-2 mb-2" />
                  <div className="flex gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="text-amber-600">● {g.pending} pending</span>
                    <span className="text-emerald-600">● {g.approved} sesuai</span>
                    {g.rejected > 0 && (
                      <span className="text-rose-600">● {g.rejected} ditolak</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filters + Bulk Actions */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama alat, kode, ruangan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-64 pl-10 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 font-medium transition-all focus:bg-white"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as VerificationStatusValue);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger className="w-56 h-10 rounded-xl border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:ring-indigo-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="PENDING">⏳ Menunggu Verifikasi</SelectItem>
                <SelectItem value="REVISED">🔄 Revisi Dikirim</SelectItem>
                <SelectItem value="REJECTED">❌ Ditolak / Tidak Sesuai</SelectItem>
                <SelectItem value="APPROVED">✅ Sesuai (Disetujui)</SelectItem>
                {user.role === 'ADMIN' && <SelectItem value="DRAFT">📝 Draft</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk actions */}
          {status === 'PENDING' && selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-200 animate-in fade-in slide-in-from-right-4 shadow-sm w-full sm:w-auto justify-end">
              <span className="text-sm font-bold text-indigo-700 mr-2">
                {selectedIds.length} terpilih
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 rounded-lg h-9 gap-1.5 font-bold"
                onClick={() => setShowRejectModal(true)}
                disabled={isBulkActioning}
              >
                <XCircle className="w-4 h-4" />
                Tidak Sesuai
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-9 gap-1.5 shadow-sm font-bold"
                onClick={handleBulkApprove}
                disabled={isBulkActioning}
              >
                {isBulkActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Tandai Sesuai
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {status === 'PENDING' && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 accent-indigo-600"
                        checked={filtered.length > 0 && selectedIds.length === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nama Alat
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ruangan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Merk / Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Kondisi
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: status === 'PENDING' ? 8 : 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={status === 'PENDING' ? 8 : 7} className="py-16 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                      <p className="font-semibold text-slate-500">
                        Tidak ada data pada status ini.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Semua aset telah diverifikasi atau tidak ada data.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const kondisiColor: Record<string, string> = {
                      Baik: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                      Rusak: 'text-rose-700 bg-rose-50 border-rose-200',
                      'tdk beroperasi': 'text-amber-700 bg-amber-50 border-amber-200',
                      'tdk berfungsi': 'text-slate-600 bg-slate-100 border-slate-300',
                    };
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                      >
                        {status === 'PENDING' && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 accent-indigo-600"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.kode_alat}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-semibold text-slate-900 truncate">{item.nama_alat}</p>
                          {item.no_seri && (
                            <p className="text-xs text-slate-400 font-mono">{item.no_seri}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.group ? (
                            <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                              {item.group.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700 font-medium text-xs">{item.merk ?? '—'}</p>
                          <p className="text-xs text-slate-400">{item.type ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${kondisiColor[item.berfungsi] ?? 'text-slate-600 bg-slate-100 border-slate-200'}`}
                          >
                            {item.berfungsi}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <VerificationBadge status={item.verification_status ?? 'PENDING'} />
                          {item.rejection_reason && (
                            <p
                              className="text-[10px] text-rose-600 mt-1 max-w-[140px] truncate"
                              title={item.rejection_reason}
                            >
                              "{item.rejection_reason}"
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* Admin: Satu-klik resolve untuk REJECTED */}
                            {user.role === 'ADMIN' && item.verification_status === 'REJECTED' && (
                              <Button
                                size="sm"
                                onClick={() => resolveMutation.mutate(item.id)}
                                disabled={
                                  resolveMutation.isPending && resolveMutation.variables === item.id
                                }
                                className="rounded-xl text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              >
                                {resolveMutation.isPending &&
                                resolveMutation.variables === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Terima Laporan
                              </Button>
                            )}
                            <Link href={`/alkes/${item.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl text-xs gap-1.5 h-8 border-slate-200 hover:bg-slate-100"
                              >
                                {user.role === 'ADMIN' && status === 'REJECTED'
                                  ? 'Edit Data'
                                  : status === 'PENDING'
                                    ? 'Periksa & Edit'
                                    : 'Tinjau'}
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer info */}
          {filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 text-xs font-medium text-slate-400 bg-slate-50/50 flex items-center justify-between">
              <span>
                Menampilkan {filtered.length} dari {alkes.length} aset
              </span>
              {selectedIds.length > 0 && (
                <span className="text-indigo-600 font-bold">{selectedIds.length} dipilih</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border-0">
            <div className="bg-rose-50 px-6 py-6 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-rose-900">Catat Ketidaksesuaian</h3>
                  <p className="text-sm text-rose-700 font-medium mt-0.5">
                    {selectedIds.length} aset akan ditandai tidak sesuai
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">
                Alasan Ketidaksesuaian <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 p-3.5 text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none transition resize-none bg-slate-50"
                rows={4}
                placeholder="Contoh: Barang tidak ditemukan di ruangan, merk berbeda dengan yang tercatat, kondisi rusak parah, dll."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Catatan ini akan diteruskan ke Admin untuk disesuaikan.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100 rounded-b-3xl">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectNote('');
                }}
                disabled={isBulkActioning}
                className="rounded-xl font-semibold"
              >
                Batal
              </Button>
              <Button
                onClick={confirmReject}
                disabled={isBulkActioning || !rejectNote.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md gap-2"
              >
                {isBulkActioning && <Loader2 className="w-4 h-4 animate-spin" />}
                Kirim Laporan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
