'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Box,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Plus,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function timeAgo(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes <= 1 ? 'Baru saja' : `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari yang lalu`;
}

function formatCurrency(val: number) {
  if (val >= 1_000_000_000)
    return `Rp ${(val / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (val >= 1_000_000)
    return `Rp ${(val / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
  return `Rp ${val.toLocaleString('id-ID')}`;
}

function StatCard({
  title,
  value,
  sub,
  colorClass,
  bgClass,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  sub?: string;
  colorClass: string;
  bgClass: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="relative overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 bg-white group p-6 flex flex-col items-center justify-center text-center">
      <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
        <div
          className={`absolute top-0 right-2 w-14 h-14 rounded-full filter blur-xl opacity-40 mix-blend-multiply ${bgClass}`}
        />
        <div className="absolute bottom-0 left-2 w-14 h-14 rounded-full filter blur-xl opacity-40 mix-blend-multiply bg-indigo-300" />
        <div className="absolute top-2 left-2 w-12 h-12 rounded-full filter blur-xl opacity-40 mix-blend-multiply bg-rose-200" />
        <div className="relative z-10 flex items-center justify-center p-3.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 shadow-sm">
          <Icon className={`w-7 h-7 ${colorClass}`} strokeWidth={2} />
        </div>
      </div>
      <div className="space-y-1.5 w-full">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">{title}</p>
        <p className="text-3xl font-black tracking-tight text-slate-800">
          {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
        </p>
      </div>
      {sub && (
        <div className="mt-4 flex items-center text-[11px] font-bold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-lg">
          <TrendingUp className="w-3 h-3 mr-1.5" />
          {sub}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data.data),
  });

  const { data: chartRes, isLoading: chartLoading } = useQuery({
    queryKey: ['dashboard-chart'],
    queryFn: () => api.get('/dashboard/chart').then((r) => r.data.data),
  });

  const { data: chartPengajuanRes, isLoading: chartPengajuanLoading } = useQuery({
    queryKey: ['dashboard-chart-pengajuan'],
    queryFn: () => api.get('/dashboard/chart-pengajuan').then((r) => r.data.data),
  });

  const { data: perhatianRes, isLoading: perhatianLoading } = useQuery({
    queryKey: ['dashboard-perhatian'],
    queryFn: () => api.get('/dashboard/perhatian').then((r) => r.data.data),
    refetchInterval: 60000, // auto refresh every minute
  });

  const stats = statsRes;
  const chartData = chartRes ?? [];
  const pengajuanData = chartPengajuanRes ?? [];
  const perhatianData = perhatianRes ?? [];

  return (
    <div className="space-y-8 p-6 md:p-8 w-full max-w-screen-2xl mx-auto animate-in fade-in duration-700 pb-20">
      {/* Welcome Banner */}
      <div className="relative rounded-[2rem] bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-600 p-8 md:p-10 text-white shadow-2xl shadow-indigo-500/20 overflow-hidden border border-white/10">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-10 -mb-20 w-80 h-80 bg-cyan-400/20 blur-[80px] rounded-full pointer-events-none" />

        {/* Abstract shapes */}
        <svg
          aria-hidden="true"
          className="absolute right-0 top-0 h-full w-1/2 opacity-20 pointer-events-none"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M353.5 174C353.5 273.135 273.135 353.5 174 353.5C74.8648 353.5 -5.5 273.135 -5.5 174C-5.5 74.8648 74.8648 -5.5 174 -5.5C273.135 -5.5 353.5 74.8648 353.5 174Z"
            stroke="url(#paint0_linear)"
            strokeWidth="110"
          />
          <defs>
            <linearGradient
              id="paint0_linear"
              x1="-5.5"
              y1="174"
              x2="353.5"
              y2="174"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="white" />
              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
            {/* New Gradients for Bar Chart */}
            <linearGradient id="colorBaik" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="colorRusak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="colorTdk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3} />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-full backdrop-blur-md uppercase tracking-widest shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {user?.role ?? 'User'}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Selamat datang,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-cyan-200">
                {user?.name ?? 'User'} 👋
              </span>
            </h1>
            <p className="text-blue-100/90 text-lg max-w-xl font-medium leading-relaxed">
              Ringkasan inventaris aset medis dan prasarana Anda hari ini. Segala sesuatu terpantau
              dengan baik.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/pengajuan/baru"
              className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-indigo-700 hover:bg-blue-50 font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
              Buat Pengajuan
            </Link>
            {isAdmin && (
              <Link
                href="/verifikasi/alkes"
                className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold rounded-xl backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <ClipboardCheck className="w-5 h-5" />
                Verifikasi Import
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            <Skeleton key={i} className="h-40 rounded-[1.5rem] shadow-sm bg-slate-200/50" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Alkes"
              value={stats?.total_alkes ?? 0}
              icon={Box}
              colorClass="text-slate-800"
              bgClass="bg-slate-400"
            />
            <StatCard
              title="Kondisi Baik"
              value={stats?.alkes_baik ?? 0}
              icon={CheckCircle2}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-500"
            />
            <StatCard
              title="Kondisi Rusak"
              value={stats?.alkes_rusak ?? 0}
              icon={AlertTriangle}
              colorClass="text-rose-600"
              bgClass="bg-rose-500"
            />
            <StatCard
              title="Tdk Berfungsi"
              value={(stats?.alkes_tdk_berfungsi ?? 0) + (stats?.alkes_tdk_beroperasi ?? 0)}
              icon={Activity}
              colorClass="text-amber-600"
              bgClass="bg-amber-400"
            />
            <StatCard
              title="Total Prasarana"
              value={stats?.total_prasarana ?? 0}
              icon={Building2}
              colorClass="text-indigo-600"
              bgClass="bg-indigo-500"
            />
            <StatCard
              title="Nilai Aset"
              value={formatCurrency(Number(stats?.total_nilai_alkes ?? 0))}
              icon={Banknote}
              colorClass="text-blue-600"
              bgClass="bg-blue-500"
              sub="Estimasi Total"
            />
          </>
        )}
      </div>

      {/* Main Content Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Charts */}
        <div className="xl:col-span-2 space-y-8">
          <Card className="border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] overflow-hidden bg-white/70 backdrop-blur-xl">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/50 border-b border-slate-100/50 pb-6 pt-8 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 rounded-xl">
                    <Activity className="w-6 h-6 text-indigo-600" />
                  </div>
                  Distribusi Kondisi Alkes
                </CardTitle>
                <CardDescription className="text-slate-500 mt-2 text-base font-medium">
                  Visualisasi status kelayakan pakai alat kesehatan berdasarkan kelompok.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {chartLoading ? (
                <Skeleton className="h-[400px] w-full rounded-2xl bg-slate-100/50" />
              ) : chartData.length === 0 ? (
                <div className="h-[350px] flex flex-col items-center justify-center text-slate-400 gap-4">
                  <Box className="w-16 h-16 opacity-20" />
                  <p className="font-medium text-lg">Belum ada data chart yang tersedia.</p>
                </div>
              ) : (
                <div className="h-[400px] w-full min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="group"
                        angle={-35}
                        textAnchor="end"
                        tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        dy={15}
                      />
                      <YAxis
                        tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        dx={-15}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc', opacity: 0.6 }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.8)',
                          boxShadow: '0 20px 40px -5px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          backdropFilter: 'blur(10px)',
                          padding: '12px 16px',
                        }}
                        itemStyle={{ fontWeight: 600, padding: '4px 0' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: '50px' }}
                        iconType="circle"
                        formatter={(value) => (
                          <span className="text-slate-600 font-semibold ml-1">{value}</span>
                        )}
                      />
                      <Bar
                        dataKey="baik"
                        name="Kondisi Baik"
                        stackId="a"
                        fill="url(#colorBaik)"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={45}
                      />
                      <Bar
                        dataKey="rusak"
                        name="Rusak"
                        stackId="a"
                        fill="url(#colorRusak)"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={45}
                      />
                      <Bar
                        dataKey="tdk_berfungsi"
                        name="Tidak Berfungsi"
                        stackId="a"
                        fill="url(#colorTdk)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={45}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Chart: Pengajuan & Pembelian */}
          <Card className="border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] overflow-hidden bg-white/70 backdrop-blur-xl">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-white/50 border-b border-slate-100/50 pb-6 pt-8 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  Statistik Pengajuan & Pembelian
                </CardTitle>
                <CardDescription className="text-slate-500 mt-2 text-base font-medium">
                  Tren jumlah barang yang diajukan vs sudah dibeli per bulan.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {chartPengajuanLoading ? (
                <Skeleton className="h-[350px] w-full rounded-2xl bg-slate-100/50" />
              ) : pengajuanData.length === 0 ? (
                <div className="h-[350px] flex flex-col items-center justify-center text-slate-400 gap-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p className="font-medium text-lg">Belum ada data pengajuan.</p>
                </div>
              ) : (
                <div className="h-[350px] w-full min-h-[350px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={pengajuanData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="bulan"
                        tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        dx={-15}
                      />
                      <Tooltip
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.8)',
                          boxShadow: '0 20px 40px -5px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          backdropFilter: 'blur(10px)',
                          padding: '12px 16px',
                        }}
                        itemStyle={{ fontWeight: 600, padding: '4px 0' }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                        formatter={(value) => (
                          <span className="text-slate-600 font-semibold ml-1">{value}</span>
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="diajukan"
                        name="Diajukan"
                        stroke="#3b82f6"
                        strokeWidth={4}
                        dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="dibeli"
                        name="Sudah Dibeli"
                        stroke="#10b981"
                        strokeWidth={4}
                        dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity / Tasks */}
        <div className="space-y-8">
          <Card className="border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] overflow-hidden bg-white/70 backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="bg-white/40 pb-5 pt-8 px-7 border-b border-slate-100/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Perlu Perhatian
                </CardTitle>
                {perhatianData && perhatianData.length > 0 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    {perhatianData.length} Baru
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="divide-y divide-slate-100/60">
                {perhatianLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <div key={i} className="p-6 flex items-start gap-4">
                      <Skeleton className="w-11 h-11 rounded-2xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))
                ) : perhatianData.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <CheckCircle2 className="w-12 h-12 opacity-30 text-emerald-500" />
                    <p className="font-medium text-sm">
                      Semua aman, tidak ada yang perlu diperhatikan.
                    </p>
                  </div>
                ) : (
                  perhatianData.map(
                    (item: {
                      id: string;
                      type: string;
                      title: string;
                      desc: string;
                      date: string;
                      link: string;
                    }) => {
                      let IconComponent = AlertTriangle;
                      let colorTheme =
                        'text-rose-600 bg-rose-100 group-hover:bg-rose-600 group-hover:text-white';
                      let textTheme = 'group-hover:text-rose-600';

                      if (item.type === 'pengajuan_pending') {
                        IconComponent = FileText;
                        colorTheme =
                          'text-blue-600 bg-blue-100 group-hover:bg-blue-600 group-hover:text-white';
                        textTheme = 'group-hover:text-blue-600';
                      } else if (item.type === 'verifikasi_pending') {
                        IconComponent = ClipboardCheck;
                        colorTheme =
                          'text-emerald-600 bg-emerald-100 group-hover:bg-emerald-600 group-hover:text-white';
                        textTheme = 'group-hover:text-emerald-600';
                      }

                      return (
                        <Link href={item.link} key={`${item.type}-${item.id}`} className="block">
                          <div className="p-6 hover:bg-slate-50/50 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-indigo-500">
                            <div className="flex items-start gap-4">
                              <div
                                className={`p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 shadow-sm ${colorTheme}`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <h4
                                  className={`font-bold text-slate-800 line-clamp-1 transition-colors ${textTheme}`}
                                >
                                  {item.title}
                                </h4>
                                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                  {item.desc}
                                </p>
                                <div className="flex items-center text-[11px] font-bold text-slate-400 mt-2 gap-1.5 uppercase tracking-wider">
                                  <Clock className="w-3.5 h-3.5" /> {timeAgo(item.date)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    },
                  )
                )}
              </div>

              <div className="p-5 border-t border-slate-100/60 bg-slate-50/30">
                <Link
                  href="/pengajuan"
                  className="flex items-center justify-center w-full py-2.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                  Lihat Semua Aktivitas <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
