'use client';

import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  FileEdit, 
  XCircle, 
  Ban, 
  PackageCheck,
  LucideIcon 
} from 'lucide-react';

type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'FULFILLED';

const STATUS_MAP: Record<RequestStatus, { label: string; className: string; icon: LucideIcon }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-500/10 text-slate-600 border-slate-200/50',
    icon: FileEdit,
  },
  PENDING: {
    label: 'Menunggu Review',
    className: 'bg-amber-500/10 text-amber-700 border-amber-200/50',
    icon: Clock,
  },
  APPROVED: {
    label: 'Disetujui',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Ditolak',
    className: 'bg-rose-500/10 text-rose-700 border-rose-200/50',
    icon: XCircle,
  },
  CANCELLED: {
    label: 'Dibatalkan',
    className: 'bg-zinc-500/10 text-zinc-700 border-zinc-200/50',
    icon: Ban,
  },
  FULFILLED: {
    label: 'Terpenuhi',
    className: 'bg-blue-500/10 text-blue-700 border-blue-200/50',
    icon: PackageCheck,
  },
};

export function RequestStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status || !(status in STATUS_MAP)) {
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-slate-200 bg-slate-50', className)}>
        N/A
      </span>
    );
  }

  const cfg = STATUS_MAP[status as RequestStatus];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300',
        cfg.className,
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}
