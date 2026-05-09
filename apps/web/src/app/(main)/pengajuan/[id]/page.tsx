'use client';

import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Info,
  LayoutGrid,
  Package,
  RefreshCw,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

type VerifLog = {
  id: string;
  from_status: string;
  to_status: string;
  actor: { name: string };
  note: string | null;
  created_at: string;
};

type ReqDetail = {
  id: string;
  request_no: string;
  nama_alat: string;
  quantity: number;
  type: string;
  status: string;
  justifikasi: string;
  rejection_reason?: string | null;
  requester?: { id: string; name: string; role?: string } | null;
  reviewer?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
  created_at: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  fulfilled_at?: string | null;
  procurement_photo_url?: string | null;
  qr_code?: string | null;
};

export default function PengajuanDetailPage() {
  const params = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const [reason, setReason] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['request', 'detail', params.id],
    queryFn: async () => {
      const res = await api.get(`/requests/${params.id}`);
      return res.data?.data as ReqDetail;
    },
    enabled: Boolean(params.id),
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['request', 'logs', params.id],
    queryFn: async () => {
      const res = await api.get(`/requests/${params.id}/verification-logs`);
      return res.data?.data as VerifLog[];
    },
    enabled: Boolean(params.id),
  });

  const submitMut = useMutation({
    mutationFn: async () => api.post(`/requests/${params.id}/submit`),
    onSuccess: () => refetch(),
  });

  const cancelMut = useMutation({
    mutationFn: async () => api.post(`/requests/${params.id}/cancel`),
    onSuccess: () => refetch(),
  });

  const approveMut = useMutation({
    mutationFn: async () => api.post(`/requests/${params.id}/approve`),
    onSuccess: () => refetch(),
  });

  const rejectMut = useMutation({
    mutationFn: async () => api.post(`/requests/${params.id}/reject`, { note: reason }),
    onSuccess: () => {
      setReason('');
      refetch();
    },
  });

  const isOwner = data?.requester?.id && userId ? data.requester.id === userId : false;
  const canSubmit =
    (role === 'STAFF' || role === 'MANAGER' || role === 'ADMIN') &&
    isOwner &&
    (data?.status === 'DRAFT' || data?.status === 'REJECTED');
  const canCancel =
    (role === 'STAFF' || role === 'MANAGER' || role === 'ADMIN') &&
    isOwner &&
    (data?.status === 'DRAFT' || data?.status === 'PENDING');
  const canReview = role === 'ADMIN' && data?.status === 'PENDING';

  // Also display the workflow actions block if any action is available, OR if we want to show a message.
  const showWorkflow =
    canSubmit || canCancel || canReview || data?.status === 'DRAFT' || data?.status === 'PENDING';

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-semibold text-slate-800">Data pengajuan tidak ditemukan.</h2>
        <Link href="/pengajuan">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8 w-full max-w-screen-2xl mx-auto animate-in fade-in duration-700 pb-20">
      {/* Header section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/pengajuan">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-extrabold rounded-full uppercase tracking-widest shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              <span>{data.request_no}</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            Detail Pengajuan
          </h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            Dibuat pada{' '}
            <span className="font-bold text-slate-800 bg-white/50 px-2 py-0.5 rounded-md border border-slate-100">
              {new Date(data.created_at).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          className="h-12 px-6 gap-2 rounded-xl border-slate-200 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 font-bold text-slate-600 transition-all shadow-sm w-full md:w-auto"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content Info */}
        <div className="xl:col-span-2 space-y-8">
          <Card className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/50 border-b border-slate-100/60 pb-6 pt-8 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100/80 rounded-xl shadow-inner text-blue-600">
                    <Package className="w-6 h-6" />
                  </div>
                  Informasi Alat
                </CardTitle>
                <CardDescription className="text-slate-500 mt-2 text-base font-medium">
                  Rincian spesifik barang yang diajukan.
                </CardDescription>
              </div>
              <RequestStatusBadge status={data.status} />
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-8">
                <div className="space-y-1.5 p-4 rounded-2xl bg-white/50 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" /> Nama Alat
                  </div>
                  <div className="font-extrabold text-xl text-slate-800">{data.nama_alat}</div>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-white/50 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Jumlah & Tipe
                  </div>
                  <div className="font-extrabold text-xl text-indigo-600">
                    {data.quantity} <span className="text-slate-800">Unit</span>{' '}
                    <span className="text-slate-400 font-medium text-sm ml-2 bg-slate-100 px-2 py-0.5 rounded-md">
                      ({data.type})
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-white/50 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Pengaju
                  </div>
                  <div className="font-bold text-lg text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center text-xs font-black text-indigo-700 shadow-inner">
                      {data.requester?.name ? data.requester.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    {data.requester?.name ?? '-'}
                  </div>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-white/50 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5" /> Ruangan / Grup
                  </div>
                  <div className="font-bold text-lg text-slate-800 bg-slate-100/50 w-fit px-3 py-1 rounded-lg border border-slate-200/50">
                    {data.group?.name ?? '-'}
                  </div>
                </div>

                <div className="sm:col-span-2 pt-6 mt-2 border-t border-slate-100/60">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Justifikasi Pengajuan
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-[1.5rem] p-6 text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm font-medium text-[15px]">
                    {data.justifikasi}
                  </div>
                </div>

                {data.rejection_reason && (
                  <div className="sm:col-span-2 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 p-6 relative overflow-hidden shadow-sm mt-4">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                    <div className="flex items-center gap-2 text-rose-700 font-black mb-3 text-lg">
                      <XCircle className="w-6 h-6" />
                      Alasan Penolakan
                    </div>
                    <div className="text-rose-800/90 leading-relaxed font-medium text-[15px] bg-white/50 p-4 rounded-xl border border-rose-100">
                      {data.rejection_reason}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bukti Pembelian (If FULFILLED) */}
          {data.status === 'FULFILLED' && (
            <Card className="rounded-[2rem] border border-emerald-200/60 bg-emerald-50/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(16,185,129,0.06)] overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-100/50 to-white/50 border-b border-emerald-100/60 pb-6 pt-8 px-8">
                <CardTitle className="text-2xl font-extrabold text-emerald-800 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 rounded-xl shadow-inner text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  Barang Telah Dibeli
                </CardTitle>
                <CardDescription className="text-emerald-700/80 mt-2 text-base font-medium">
                  Pengadaan barang telah selesai pada{' '}
                  <span className="font-bold bg-white/60 px-2 py-0.5 rounded-md">
                    {data.fulfilled_at
                      ? new Date(data.fulfilled_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '-'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {data.procurement_photo_url && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Bukti Pembelian / Foto Barang
                      </div>
                      <div className="rounded-[1.5rem] overflow-hidden border border-emerald-200/60 bg-white p-2 shadow-sm">
                        <img
                          src={data.procurement_photo_url}
                          alt="Bukti Barang"
                          className="w-full h-auto max-h-[300px] object-cover rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                  {data.qr_code && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                        <Package className="w-4 h-4" /> QR Code Inventaris
                      </div>
                      <div className="bg-white p-8 rounded-[1.5rem] border border-emerald-200/60 shadow-sm flex flex-col items-center justify-center text-center space-y-4 h-[calc(100%-2rem)] min-h-[200px]">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-inner">
                          <LayoutGrid className="w-12 h-12 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Kode Seri / Identifikasi
                          </p>
                          <p className="font-mono font-black text-xl text-emerald-800 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl shadow-sm">
                            {data.qr_code}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Riwayat Workflow Card */}
          <Card className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/50 border-b border-slate-100/60 pb-6 pt-8 px-8">
              <CardTitle className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl shadow-inner text-purple-600">
                  <History className="w-6 h-6" />
                </div>
                Riwayat Aktivitas
              </CardTitle>
              <CardDescription className="text-slate-500 mt-2 text-base font-medium">
                Jejak status pengajuan dari awal hingga saat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {loadingLogs ? (
                <div className="space-y-6">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              ) : !logs || logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center bg-slate-50/50 rounded-2xl border border-slate-100">
                  <Clock className="w-12 h-12 text-slate-300 mb-4" />
                  <span className="font-medium text-lg">Belum ada riwayat aktivitas.</span>
                </div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[1.4rem] md:before:mx-auto before:h-full before:w-1 before:bg-gradient-to-b before:from-indigo-100 before:via-indigo-50 before:to-transparent before:rounded-full pt-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="relative flex items-start md:items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                    >
                      {/* Icon Indicator */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white bg-indigo-500 text-white shadow-md shrink-0 md:order-1 z-10 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 mt-1 md:mt-0">
                        <Clock className="w-5 h-5" />
                      </div>

                      {/* Card Content */}
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-white/80 backdrop-blur-sm p-5 rounded-[1.5rem] border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                          <span className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                            {log.to_status}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono font-bold bg-slate-50 px-2 py-1 rounded-md border border-slate-100 w-fit">
                            {new Date(log.created_at).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-[13px] text-slate-500 font-medium mb-3 flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600">
                            {log.actor.name.charAt(0).toUpperCase()}
                          </div>
                          Oleh: <span className="font-bold text-slate-700">{log.actor.name}</span>
                        </div>
                        {log.note && (
                          <div className="text-[13px] bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-slate-600 italic font-medium leading-relaxed">
                            "{log.note}"
                          </div>
                        )}
                        {log.from_status !== log.to_status && (
                          <div className="text-[11px] font-bold mt-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            Dari{' '}
                            <span className="font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              {log.from_status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-8">
          <Card className="rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-24 overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-indigo-50/80 to-transparent pb-4 pt-8 px-8">
              <CardTitle className="text-xl font-extrabold flex items-center gap-3 text-slate-800">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-md text-white">
                  <Send className="w-5 h-5" />
                </div>
                Aksi Workflow
              </CardTitle>
              <CardDescription className="font-medium mt-3 text-slate-500">
                Tindakan yang dapat Anda lakukan untuk tiket pengajuan ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {!showWorkflow && (
                <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-medium">Tidak ada aksi yang tersedia saat ini.</p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {canSubmit && (
                  <Button
                    className="w-full h-14 rounded-xl gap-2 font-bold text-base bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => submitMut.mutate()}
                    disabled={submitMut.isPending}
                  >
                    <Send className="w-5 h-5" /> Ajukan ke Admin
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="outline"
                    className="w-full h-14 rounded-xl gap-2 font-bold text-base border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all duration-300"
                    onClick={() => cancelMut.mutate()}
                    disabled={cancelMut.isPending}
                  >
                    <XCircle className="w-5 h-5" /> Batalkan Pengajuan
                  </Button>
                )}

                {canReview && (
                  <div className="space-y-5 pt-2">
                    <div className="p-4 bg-emerald-50/80 border border-emerald-100 rounded-2xl text-[13px] text-emerald-800 leading-relaxed font-medium">
                      <strong>Panel Admin:</strong> Harap pastikan detail barang dan justifikasi
                      sudah sesuai sebelum Anda menyetujuinya.
                    </div>

                    <Button
                      className="w-full h-14 rounded-xl gap-2 font-bold text-base bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300"
                      onClick={() => approveMut.mutate()}
                      disabled={approveMut.isPending}
                    >
                      <CheckCircle2 className="w-5 h-5" /> Setujui Pengajuan
                    </Button>

                    <div className="flex items-center gap-4 my-6">
                      <Separator className="flex-1 bg-slate-200" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Atau Tolak
                      </span>
                      <Separator className="flex-1 bg-slate-200" />
                    </div>

                    <div className="space-y-3 bg-rose-50/50 p-5 rounded-2xl border border-rose-100">
                      <label
                        htmlFor="reject-reason"
                        className="text-[11px] font-extrabold text-rose-700 flex items-center gap-2 uppercase tracking-widest"
                      >
                        <XCircle className="w-4 h-4" /> Alasan Penolakan
                      </label>
                      <Textarea
                        id="reject-reason"
                        className="w-full h-24 rounded-xl border-rose-200 bg-white focus-visible:ring-rose-500 resize-none placeholder:text-slate-400 font-medium text-sm"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Tulis alasan spesifik mengapa pengajuan ini ditolak..."
                      />
                      <Button
                        variant="destructive"
                        className="w-full h-12 rounded-xl gap-2 font-bold text-sm shadow-md hover:-translate-y-0.5 transition-all"
                        onClick={() => rejectMut.mutate()}
                        disabled={rejectMut.isPending || reason.trim().length < 5}
                      >
                        <XCircle className="w-4 h-4" /> Konfirmasi Penolakan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
