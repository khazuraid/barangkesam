'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';

export type LogUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
};

export type ActivityLogItem = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  user?: LogUser | null;
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-[#003ec7] border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-[#eff4ff] text-[#003ec7] border-[#c7d8ff]',
  LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
  IMPORT: 'bg-violet-50 text-violet-700 border-violet-200',
  EXPORT: 'bg-amber-50 text-amber-700 border-amber-200',
  UPLOAD: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  TOGGLE_ACTIVE: 'bg-orange-50 text-orange-700 border-orange-200',
  RESET_PASSWORD: 'bg-rose-50 text-rose-700 border-rose-200',
};

function actionClass(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-slate-100 text-slate-700 border-slate-200';
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

export function LogDetailDialog({
  log,
  onClose,
}: {
  log: ActivityLogItem | null;
  onClose: () => void;
}) {
  const metadataStr = log?.metadata ? JSON.stringify(log.metadata, null, 2) : null;

  return (
    <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#003ec7]" />
            Detail Log Aktivitas
          </DialogTitle>
          <DialogDescription>
            Informasi lengkap tentang log aktivitas yang dipilih.
          </DialogDescription>
        </DialogHeader>

        {log && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile label="Aksi">
                <Badge
                  className={`rounded-md border px-2.5 py-0.5 font-medium text-xs ${actionClass(log.action)}`}
                >
                  {log.action}
                </Badge>
              </InfoTile>
              <InfoTile label="Waktu">
                <p className="font-medium text-slate-900 text-sm">
                  {formatDateTime(log.created_at)}
                </p>
              </InfoTile>
              <InfoTile label="Entitas">
                <p className="font-mono text-slate-900 text-sm">{log.entity}</p>
              </InfoTile>
              <InfoTile label="Entity ID">
                <p className="truncate font-mono text-slate-900 text-xs">{log.entity_id ?? '-'}</p>
              </InfoTile>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-1 text-slate-500 text-xs uppercase tracking-wide">Deskripsi</p>
              <p className="text-slate-800 text-sm">
                {log.description ?? <span className="text-slate-400 italic">Tanpa deskripsi</span>}
              </p>
            </div>

            {log.user && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-2 text-slate-500 text-xs uppercase tracking-wide">Pengguna</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003ec7] font-medium text-white text-sm">
                    {getInitials(log.user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm">{log.user.name}</p>
                    <p className="truncate text-slate-500 text-xs">{log.user.email}</p>
                  </div>
                  <Badge className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700 text-xs">
                    {log.user.role}
                  </Badge>
                </div>
              </div>
            )}

            {(log.ip_address || log.user_agent) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {log.ip_address && (
                  <InfoTile label="IP Address">
                    <p className="font-mono text-slate-900 text-xs">{log.ip_address}</p>
                  </InfoTile>
                )}
                {log.user_agent && (
                  <InfoTile label="User Agent">
                    <p className="line-clamp-2 text-slate-700 text-xs">{log.user_agent}</p>
                  </InfoTile>
                )}
              </div>
            )}

            {metadataStr && (
              <div className="rounded-lg border border-slate-200 bg-slate-900 p-3">
                <p className="mb-2 text-slate-400 text-xs uppercase tracking-wide">Metadata</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-slate-200 text-xs">
                  {metadataStr}
                </pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="mb-1 text-slate-500 text-xs uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}
