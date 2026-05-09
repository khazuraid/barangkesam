'use client';

import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { VerificationBadge, type VerificationStatus } from './VerificationBadge';

interface VerificationLogItem {
  id: string;
  entity_type: string;
  entity_id: string;
  from_status: string;
  to_status: string;
  note: string | null;
  created_at: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
}

interface Props {
  alkesId: string;
}

export function VerificationTimeline({ alkesId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['alkes', alkesId, 'verification-logs'],
    queryFn: async () => {
      const res = await api.get<{ data: VerificationLogItem[] }>(
        `/alkes/${alkesId}/verification-logs`,
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Memuat riwayat verifikasi...</p>;
  }
  if (isError) {
    return <p className="text-sm text-rose-600">Gagal memuat riwayat.</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada riwayat verifikasi.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {data.map((log) => (
        <li key={log.id} className="relative">
          <span className="absolute -left-[25px] top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#003ec7] ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            {log.from_status && log.from_status !== 'NONE' ? (
              <VerificationBadge status={log.from_status as VerificationStatus} showIcon={false} />
            ) : (
              <span className="text-xs font-semibold text-slate-500">NEW</span>
            )}
            <span className="material-symbols-outlined text-base text-slate-400">
              arrow_forward
            </span>
            <VerificationBadge status={log.to_status as VerificationStatus} showIcon={false} />
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Oleh <span className="font-semibold">{log.actor?.name ?? 'Sistem'}</span>
            {log.actor?.role ? (
              <span className="ml-1 text-xs text-slate-500">({log.actor.role})</span>
            ) : null}
          </p>
          {log.note ? (
            <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-600">
              “{log.note}”
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">
            {new Date(log.created_at).toLocaleString('id-ID')}
          </p>
        </li>
      ))}
    </ol>
  );
}
