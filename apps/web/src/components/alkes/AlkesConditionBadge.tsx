'use client';

import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  AlertTriangle,
  LucideIcon 
} from 'lucide-react';

export type AlkesCondition = 'Baik' | 'Rusak' | 'tdk beroperasi' | 'tdk berfungsi';

const CONDITION_CONFIG: Record<
  AlkesCondition,
  { label: string; shortLabel: string; className: string; icon: LucideIcon }
> = {
  Baik: {
    label: 'Baik',
    shortLabel: 'Baik',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50',
    icon: CheckCircle2,
  },
  Rusak: {
    label: 'Rusak',
    shortLabel: 'Rusak',
    className: 'bg-rose-500/10 text-rose-700 border-rose-200/50',
    icon: AlertCircle,
  },
  'tdk beroperasi': {
    label: 'Tidak Beroperasi',
    shortLabel: 'Tdk Op.',
    className: 'bg-amber-500/10 text-amber-700 border-amber-200/50',
    icon: Activity,
  },
  'tdk berfungsi': {
    label: 'Tidak Berfungsi',
    shortLabel: 'Tdk Fngs.',
    className: 'bg-slate-500/10 text-slate-700 border-slate-200/50',
    icon: AlertTriangle,
  },
};

interface AlkesConditionBadgeProps {
  condition: string;
  className?: string;
  short?: boolean;
}

export function AlkesConditionBadge({ condition, className, short = false }: AlkesConditionBadgeProps) {
  const cfg = CONDITION_CONFIG[condition as AlkesCondition] ?? CONDITION_CONFIG.Baik;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300 whitespace-nowrap',
        cfg.className,
        className,
      )}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {short ? cfg.shortLabel : cfg.label}
    </span>
  );
}
