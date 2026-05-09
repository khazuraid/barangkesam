'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type RequestType = 'NEW_EQUIPMENT' | 'REPLACEMENT' | 'ADDITIONAL';

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  NEW_EQUIPMENT: 'Barang Baru',
  REPLACEMENT: 'Penggantian Barang',
  ADDITIONAL: 'Penambahan Barang',
};

type FormState = {
  group_id: string;
  type: RequestType;
  nama_alat: string;
  quantity: number;
  justifikasi: string;
  merk?: string;
  type_alat?: string;
};

type AlkesGroup = {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
  children?: AlkesGroup[];
};

function flattenGroups(tree: AlkesGroup[]): AlkesGroup[] {
  const acc: AlkesGroup[] = [];
  const walk = (nodes: AlkesGroup[]) => {
    for (const n of nodes) {
      acc.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return acc;
}

export default function PengajuanBaruPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const assignedRoomId = user?.assigned_room_id ?? '';

  const [form, setForm] = useState<FormState>({
    group_id: assignedRoomId,
    type: 'NEW_EQUIPMENT',
    nama_alat: '',
    quantity: 1,
    justifikasi: '',
    merk: '',
    type_alat: '',
  });
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: groupsData } = useQuery({
    queryKey: ['alkes-groups'],
    queryFn: () => api.get('/alkes/groups').then((r) => r.data.data as AlkesGroup[]),
  });

  const groupsFlat = useMemo(() => flattenGroups(groupsData ?? []), [groupsData]);
  const assignedRoomName =
    groupsFlat.find((g) => g.id === assignedRoomId)?.name ??
    (user?.assigned_room?.name || (assignedRoomId ? 'Ruangan tidak ditemukan' : ''));

  useEffect(() => {
    if (assignedRoomId && form.group_id !== assignedRoomId) {
      setForm((prev) => ({ ...prev, group_id: assignedRoomId }));
    }
  }, [assignedRoomId, form.group_id]);

  const createMut = useMutation({
    mutationFn: async (payload: FormState) => {
      const res = await api.post('/requests', payload);
      return res.data;
    },
  });

  const submitMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/requests/${id}/submit`);
      return res.data;
    },
  });

  const onSaveDraft = async () => {
    try {
      setErrorMessage('');
      if (!form.group_id) {
        toast.error('Akun belum memiliki ruangan. Hubungi admin.');
        return;
      }
      if (!form.nama_alat.trim()) {
        toast.error('Nama barang wajib diisi');
        return;
      }

      const created = await createMut.mutateAsync(form);
      const id = created?.data?.id;
      if (id) router.push(`/pengajuan/${id}`);
    } catch (err) {
      const e = err as AxiosError<{ error?: string; details?: Record<string, string[]> }>;
      const detailText = e.response?.data?.details
        ? Object.entries(e.response.data.details)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' | ')
        : null;
      const msg = detailText || e.response?.data?.error || 'Gagal menyimpan pengajuan';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const onSaveAndSubmit = async () => {
    try {
      setErrorMessage('');
      if (!form.group_id) {
        toast.error('Akun belum memiliki ruangan. Hubungi admin.');
        return;
      }
      if (!form.nama_alat.trim()) {
        toast.error('Nama barang wajib diisi');
        return;
      }

      const created = await createMut.mutateAsync(form);
      const id = created?.data?.id;
      if (id) {
        await submitMut.mutateAsync(id);
        router.push(`/pengajuan/${id}`);
      }
    } catch (err) {
      const e = err as AxiosError<{ error?: string; details?: Record<string, string[]> }>;
      const detailText = e.response?.data?.details
        ? Object.entries(e.response.data.details)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' | ')
        : null;
      const msg = detailText || e.response?.data?.error || 'Gagal menyimpan pengajuan';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const labelClass = 'font-semibold text-[11px] tracking-wide text-slate-600 uppercase';
  const inputClass = 'h-11 rounded-lg border-slate-200';
  const actionDisabled = createMut.isPending || submitMut.isPending;

  return (
    <div className="min-h-screen bg-[#f9f9ff]">
      <main className="mx-auto w-full max-w-5xl px-6 pb-12 pt-8">
        <div className="mb-8">
          <nav aria-label="Breadcrumb" className="mb-2 flex text-sm text-slate-500">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li className="inline-flex items-center">
                <Link href="/pengajuan" className="transition-colors hover:text-blue-700">
                  Pengajuan Barang
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="material-symbols-outlined mx-1 text-sm">chevron_right</span>
                  <span className="font-medium text-slate-900">Baru</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Buat Pengajuan Barang
          </h1>
          <p className="mt-2 text-slate-500">
            Lengkapi form di bawah ini untuk mengajukan permintaan barang baru ke departemen
            inventaris.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/50 px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <span className="material-symbols-outlined text-sm">assignment_add</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Form Pengajuan</h3>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={labelClass}>
                  RUANGAN <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 text-sm">
                    meeting_room
                  </span>
                  <Input
                    className={`${inputClass} bg-slate-50 pl-10 text-slate-500`}
                    value={assignedRoomName || 'Belum ada ruangan'}
                    readOnly
                    disabled
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Ruangan pengaju otomatis terisi berdasarkan profil.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>
                  TIPE PENGAJUAN BARANG <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((p) => ({ ...p, type: v as RequestType }))}
                >
                  <SelectTrigger className={`${inputClass} w-full pl-10`}>
                    <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 text-sm">
                      category
                    </span>
                    <SelectValue placeholder="Pilih Tipe Barang">
                      {REQUEST_TYPE_LABEL[form.type]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_EQUIPMENT">Perangkat / Barang Baru</SelectItem>
                    <SelectItem value="REPLACEMENT">Penggantian Barang</SelectItem>
                    <SelectItem value="ADDITIONAL">Penambahan Barang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="space-y-1.5 md:col-span-8">
                <Label className={labelClass}>
                  NAMA BARANG <span className="text-red-500">*</span>
                </Label>
                <Input
                  className={inputClass}
                  value={form.nama_alat}
                  onChange={(e) => setForm((p) => ({ ...p, nama_alat: e.target.value }))}
                  placeholder="Contoh: Monitor LED 24 inch"
                />
              </div>

              <div className="space-y-1.5 md:col-span-4">
                <Label className={labelClass}>
                  JUMLAH <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center">
                  <button
                    type="button"
                    className="rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 p-2.5 text-slate-600 transition-colors hover:bg-slate-100"
                    onClick={() =>
                      setForm((p) => ({ ...p, quantity: Math.max(1, Number(p.quantity || 1) - 1) }))
                    }
                  >
                    <span className="material-symbols-outlined text-sm">remove</span>
                  </button>
                  <Input
                    type="number"
                    min={1}
                    className="h-11 rounded-none border-x-0 border-slate-200 text-center"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quantity: Math.max(1, Number(e.target.value || 1)) }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 p-2.5 text-slate-600 transition-colors hover:bg-slate-100"
                    onClick={() =>
                      setForm((p) => ({ ...p, quantity: Number(p.quantity || 1) + 1 }))
                    }
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FieldOptional label="MERK">
                <Input
                  className={inputClass}
                  value={form.merk}
                  onChange={(e) => setForm((p) => ({ ...p, merk: e.target.value }))}
                  placeholder="Contoh: Dell, HP, dll."
                />
              </FieldOptional>

              <FieldOptional label="TYPE BARANG">
                <Input
                  className={inputClass}
                  value={form.type_alat}
                  onChange={(e) => setForm((p) => ({ ...p, type_alat: e.target.value }))}
                  placeholder="Contoh: P2419H"
                />
              </FieldOptional>
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>
                JUSTIFIKASI / ALASAN KEBUTUHAN <span className="text-red-500">*</span>
              </Label>
              <Textarea
                className="min-h-28 rounded-lg border-slate-200"
                value={form.justifikasi}
                onChange={(e) => setForm((p) => ({ ...p, justifikasi: e.target.value }))}
                placeholder="Jelaskan alasan mengapa barang ini dibutuhkan..."
              />
              <p className="mt-1 flex items-start text-xs text-slate-500">
                <span className="material-symbols-outlined mr-1 text-[14px] text-slate-400">
                  info
                </span>
                Berikan alasan yang jelas untuk mempercepat proses persetujuan oleh atasan.
              </p>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row">
            <Link href="/pengajuan" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-2 sm:w-auto">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Kembali
              </Button>
            </Link>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                className="w-full gap-2 text-blue-700 hover:bg-blue-50 sm:w-auto"
                onClick={onSaveDraft}
                disabled={actionDisabled}
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Simpan Draft
              </Button>
              <Button
                className="w-full gap-2 bg-[#0046c0] hover:bg-[#00328e] sm:w-auto"
                onClick={onSaveAndSubmit}
                disabled={actionDisabled}
              >
                <span className="material-symbols-outlined text-sm">send</span>
                Simpan & Ajukan
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mt-0.5 text-blue-700">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div>
            <h4 className="mb-1 font-medium text-slate-900">Tips Pengajuan Cepat</h4>
            <p className="text-xs text-slate-600">
              Pastikan Anda memilih tipe barang yang tepat dan memberikan justifikasi yang rinci.
              Pengajuan dengan informasi lengkap memiliki tingkat persetujuan lebih cepat.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function FieldOptional({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex justify-between font-semibold text-[11px] tracking-wide text-slate-600 uppercase">
        {label}
        <span className="text-xs font-normal normal-case tracking-normal text-slate-400">
          (Opsional)
        </span>
      </Label>
      {children}
    </div>
  );
}
