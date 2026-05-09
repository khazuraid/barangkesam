'use client';

import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  FileEdit, 
  RotateCcw, 
  XCircle,
  LucideIcon 
} from 'lucide-react';

export type VerificationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED';

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-500/10 text-slate-600 border-slate-200/50',
    icon: FileEdit,
  },
  PENDING: {
    label: 'Menunggu Verifikasi',
    className: 'bg-amber-500/10 text-amber-700 border-amber-200/50',
    icon: Clock,
  },
  REVISED: {
    label: 'Revisi Dikirim Ulang',
    className: 'bg-indigo-500/10 text-indigo-700 border-indigo-200/50',
    icon: RotateCcw,
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
};

interface VerificationBadgeProps {
  status: VerificationStatus;
  className?: string;
  showIcon?: boolean;
}

export function VerificationBadge({ status, className, showIcon = true }: VerificationBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300',
        cfg.className,
        className,
      )}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />}
      {cfg.label}
    </span>
  );
}
