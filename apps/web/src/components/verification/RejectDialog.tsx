'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (note: string) => Promise<void> | void;
  title?: string;
  description?: string;
  isSubmitting?: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Tolak Verifikasi',
  description = 'Berikan alasan penolakan agar pegawai dapat melakukan revisi.',
  isSubmitting = false,
}: RejectDialogProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (note.trim().length < 5) {
      setError('Alasan minimal 5 karakter.');
      return;
    }
    setError(null);
    await onConfirm(note.trim());
    setNote('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setNote('');
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{description}</p>
        <div className="space-y-2">
          <Label htmlFor="reject-note">Alasan Penolakan</Label>
          <textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#003ec7] focus:outline-none focus:ring-2 focus:ring-[#003ec7]/20"
            placeholder="Contoh: Data merk tidak lengkap, mohon perbaiki..."
            disabled={isSubmitting}
          />
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {isSubmitting ? 'Memproses...' : 'Tolak'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
