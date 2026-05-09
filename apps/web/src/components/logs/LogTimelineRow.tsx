'use client';

import type { ActivityLogItem } from '@/components/logs/LogDetailDialog';
import {
  Activity,
  Database,
  Download,
  Eye,
  FileUp,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const ACTION_META: Record<
  string,
  { color: string; bg: string; ring: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  CREATE: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    ring: 'ring-emerald-200',
    Icon: Plus,
  },
  UPDATE: { color: 'text-blue-700', bg: 'bg-blue-100', ring: 'ring-blue-200', Icon: Pencil },
  DELETE: { color: 'text-red-700', bg: 'bg-red-100', ring: 'ring-red-200', Icon: Trash2 },
  LOGIN: { color: 'text-[#003ec7]', bg: 'bg-[#dde1ff]', ring: 'ring-[#c7d8ff]', Icon: LogIn },
  LOGOUT: { color: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200', Icon: LogOut },
  IMPORT: {
    color: 'text-violet-700',
    bg: 'bg-violet-100',
    ring: 'ring-violet-200',
    Icon: FileUp,
  },
  EXPORT: {
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    ring: 'ring-amber-200',
    Icon: Download,
  },
  UPLOAD: {
    color: 'text-cyan-700',
    bg: 'bg-cyan-100',
    ring: 'ring-cyan-200',
    Icon: UploadCloud,
  },
  TOGGLE_ACTIVE: {
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    ring: 'ring-orange-200',
    Icon: RefreshCcw,
  },
  RESET_PASSWORD: {
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    ring: 'ring-rose-200',
    Icon: ShieldAlert,
  },
};

function metaOf(action: string) {
  return (
    ACTION_META[action] ?? {
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      ring: 'ring-slate-200',
      Icon: Activity,
    }
  );
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
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.floor(mo / 12)} tahun lalu`;
}

export function LogTimelineRow({
  log,
  isLast,
  onOpen,
}: {
  log: ActivityLogItem;
  isLast: boolean;
  onOpen: (l: ActivityLogItem) => void;
}) {
  const m = metaOf(log.action);
  return (
    <li className="relative flex gap-4">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.bg} ${m.color} ring-4 ${m.ring}`}
        >
          <m.Icon className="h-4 w-4" />
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-gradient-to-b from-slate-200 to-transparent" />
        )}
      </div>

      {/* Content Card */}
      <button
        type="button"
        onClick={() => onOpen(log)}
        className="group mb-5 flex-1 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_4px_20px_-8px_rgba(0,62,199,0.08)] transition hover:border-[#c7d8ff] hover:shadow-[0_10px_30px_-10px_rgba(0,62,199,0.15)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-[11px] ${m.bg} ${m.color}`}
              >
                {log.action}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                {log.entity}
              </span>
              {log.entity_id && (
                <span className="truncate font-mono text-[11px] text-slate-400">
                  #{log.entity_id.slice(0, 8)}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-slate-800 text-sm">
              {log.description ?? (
                <span className="text-slate-400 italic">Tidak ada deskripsi</span>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-slate-500 text-xs">
              {log.user ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003ec7] font-semibold text-[9px] text-white">
                    {getInitials(log.user.name)}
                  </span>
                  <span className="font-medium text-slate-700">{log.user.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {log.user.role}
                  </span>
                </span>
              ) : (
                <span className="italic">System</span>
              )}
              {log.ip_address && (
                <span className="flex items-center gap-1 font-mono">
                  <Database className="h-3 w-3" />
                  {log.ip_address}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-medium text-slate-700 text-xs">{timeAgo(log.created_at)}</span>
            <span className="text-slate-400 text-[11px]">{formatDateTime(log.created_at)}</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition group-hover:bg-[#eff4ff] group-hover:text-[#003ec7] group-hover:opacity-100">
              <Eye className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
