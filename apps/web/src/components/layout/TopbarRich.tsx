'use client';

import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const TITLE_MAP: Record<string, { section: string; title: string }> = {
  '/dashboard': { section: 'Dashboard', title: 'Ringkasan Sistem' },
  '/alkes': { section: 'Alat Kesehatan', title: 'Manajemen Alat Kesehatan' },
  '/prasarana': { section: 'Prasarana', title: 'Manajemen Prasarana' },
  '/pengajuan': { section: 'Pengajuan Barang', title: 'Daftar Pengajuan' },
  '/pengajuan/baru': { section: 'Pengajuan Barang', title: 'Buat Pengajuan Barang' },
  '/export': { section: 'Export', title: 'Export Data' },
  '/import': { section: 'Import', title: 'Import Data' },
  '/import/logs': { section: 'Import', title: 'Riwayat Import' },
  '/logs': { section: 'Logs', title: 'Aktivitas Sistem' },
  '/reports': { section: 'Laporan', title: 'Laporan & Analitik' },
  '/settings': { section: 'Pengaturan', title: 'Pengaturan Sistem' },
};

function getTopbarMeta(pathname: string) {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];

  if (pathname.startsWith('/pengajuan/')) {
    return { section: 'Pengajuan Barang', title: 'Detail Pengajuan' };
  }
  if (pathname.startsWith('/alkes/')) {
    return { section: 'Alat Kesehatan', title: 'Detail Alat Kesehatan' };
  }
  if (pathname.startsWith('/verifikasi/')) {
    return { section: 'Verifikasi', title: 'Verifikasi Data' };
  }

  return { section: 'Aplikasi', title: 'Dashboard' };
}

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
};

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotifTone(type: string): string {
  if (type === 'SUCCESS') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (type === 'ERROR') return 'text-rose-700 bg-rose-50 border-rose-100';
  if (type === 'WARNING') return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-blue-700 bg-blue-50 border-blue-100';
}

function groupLabel(dateStr: string): 'Hari Ini' | 'Kemarin' | 'Sebelumnya' {
  const d = new Date(dateStr);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  if (d >= startToday) return 'Hari Ini';
  if (d >= startYesterday) return 'Kemarin';
  return 'Sebelumnya';
}

export function TopbarRich() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const meta = getTopbarMeta(pathname);
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const groupedNotifications = useMemo(() => {
    const grouped: Record<'Hari Ini' | 'Kemarin' | 'Sebelumnya', NotificationItem[]> = {
      'Hari Ini': [],
      Kemarin: [],
      Sebelumnya: [],
    };

    for (const n of notifications) {
      grouped[groupLabel(n.created_at)].push(n);
    }

    return grouped;
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotif(true);

      const [listRes, countRes] = await Promise.all([
        api.get('/notifications', { params: { page: 1, limit: 20 } }),
        api.get('/notifications/unread-count'),
      ]);

      const payload = listRes.data?.data;
      const data = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

      setNotifications(data);
      setUnreadCount(Number(countRes.data?.data?.count ?? 0));
    } catch {
      // ignore error, keep previous state
    } finally {
      setLoadingNotif(false);
    }
  }, []);

  async function handleMarkRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => (c > 0 ? c - 1 : 0));
    } catch {
      // ignore
    }
  }

  async function handleRowDoubleClick(n: NotificationItem) {
    try {
      if (!n.is_read) {
        await handleMarkRead(n.id);
      }
      if (n.link) {
        setOpenNotif(false);
        router.push(n.link);
      }
    } catch {
      // ignore
    }
  }

  async function handleRowClick(n: NotificationItem) {
    if (!n.is_read) {
      await handleMarkRead(n.id);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target as Node)) {
        setOpenNotif(false);
      }
    }

    if (openNotif) {
      document.addEventListener('mousedown', onOutsideClick);
      void fetchNotifications();
    }

    return () => {
      document.removeEventListener('mousedown', onOutsideClick);
    };
  }, [fetchNotifications, openNotif]);

  useEffect(() => {
    if (!token || !user?.id) return;

    void fetchNotifications();
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 30_000);

    const socket = connectSocket();
    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    } else {
      socket.auth = { token };
    }

    const onNew = (payload: NotificationItem) => {
      setNotifications((prev) => [payload, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    };

    const onUnreadChanged = () => {
      void fetchNotifications();
    };

    socket.on('notification.new', onNew);
    socket.on('notification.unread_count_changed', onUnreadChanged);

    return () => {
      window.clearInterval(intervalId);
      socket.off('notification.new', onNew);
      socket.off('notification.unread_count_changed', onUnreadChanged);
      disconnectSocket();
    };
  }, [fetchNotifications, token, user?.id]);

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            {meta.section}
          </p>
          <h1 className="truncate text-lg font-semibold text-slate-900">{meta.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setOpenNotif((v) => !v)}
              className="relative rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50"
              aria-label="Buka notifikasi"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="-top-1 -right-1 absolute min-h-4 min-w-4 rounded-full bg-red-500 px-1 text-center font-semibold text-[10px] leading-4 text-white ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {openNotif && (
              <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
                    <p className="text-xs text-slate-500">Aktivitas terbaru workflow pengajuan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Tandai semua dibaca
                  </button>
                </div>

                <div className="max-h-96 overflow-auto">
                  {loadingNotif ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">
                      Memuat notifikasi...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm font-medium text-slate-800">Belum ada notifikasi</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Notifikasi verifikasi akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    (['Hari Ini', 'Kemarin', 'Sebelumnya'] as const).map((section) =>
                      groupedNotifications[section].length > 0 ? (
                        <div key={section} className="border-t border-slate-100 first:border-t-0">
                          <div className="sticky top-0 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {section}
                          </div>
                          {groupedNotifications[section].map((n) => (
                            // biome-ignore lint/a11y/useKeyWithClickEvents: Interactive list item
                            <div
                              key={n.id}
                              onClick={() => void handleRowClick(n)}
                              onDoubleClick={() => void handleRowDoubleClick(n)}
                              className={`w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
                                n.is_read ? 'bg-white' : 'bg-blue-50/30'
                              }`}
                              title={
                                n.link
                                  ? 'Double click untuk buka detail'
                                  : 'Klik untuk tandai dibaca'
                              }
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <span
                                  className={`rounded border px-2 py-0.5 font-medium text-[10px] ${getNotifTone(n.type)}`}
                                >
                                  {n.type}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {timeLabel(n.created_at)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                              <p className="mt-0.5 text-xs text-slate-600">{n.message || '-'}</p>
                              <div className="mt-2 flex items-center gap-3">
                                {!n.is_read && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleMarkRead(n.id);
                                    }}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    Tandai dibaca
                                  </button>
                                )}
                                {n.link && (
                                  <Link
                                    href={n.link}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleMarkRead(n.id);
                                    }}
                                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                                  >
                                    Buka detail
                                  </Link>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null,
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
            {user?.name?.slice(0, 1)?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </div>
  );
}
