'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

type ApiError = { response?: { data?: { error?: string } } };

type AlkesGroup = {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
  children?: AlkesGroup[];
  _count?: { alkes: number };
};

interface FormState {
  id?: string;
  name: string;
  level: 1 | 2 | 3;
  parent_id: string | null;
}

function flattenGroups(tree: AlkesGroup[]): AlkesGroup[] {
  const acc: AlkesGroup[] = [];
  const walk = (nodes: AlkesGroup[]) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      acc.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return acc;
}

const LEVEL_CONFIG: Record<
  number,
  { color: string; bg: string; border: string; label: string; dot: string }
> = {
  1: {
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    label: 'Kategori',
    dot: 'bg-indigo-500',
  },
  2: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'Sub Kategori',
    dot: 'bg-purple-500',
  },
  3: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Item',
    dot: 'bg-amber-500',
  },
};

export default function KelompokAlkesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlkesGroup | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', level: 1, parent_id: null });
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: groups, isLoading } = useQuery<AlkesGroup[]>({
    queryKey: ['alkes-groups'],
    queryFn: () =>
      api.get('/alkes/groups').then((r) => {
        const d = r.data?.data;
        return Array.isArray(d) ? d : [];
      }),
  });

  const treeData = groups ?? [];
  const flat = flattenGroups(treeData);
  const parentOptions = flat.filter((g) => g.level < form.level);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), level: form.level, parent_id: form.parent_id };
      if (form.id) return api.patch(`/alkes/groups/${form.id}`, payload);
      return api.post('/alkes/groups', payload);
    },
    onSuccess: () => {
      toast.success(form.id ? 'Kelompok diperbarui' : 'Kelompok ditambahkan');
      qc.invalidateQueries({ queryKey: ['alkes-groups'] });
      setDialogOpen(false);
      setForm({ name: '', level: 1, parent_id: null });
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/alkes/groups/${id}`),
    onSuccess: () => {
      toast.success('Kelompok dihapus');
      qc.invalidateQueries({ queryKey: ['alkes-groups'] });
      setDeleteTarget(null);
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Gagal menghapus'),
  });

  const openAdd = (level: 1 | 2 | 3 = 1, parent: AlkesGroup | null = null) => {
    setForm({ name: '', level, parent_id: parent?.id ?? null });
    setDialogOpen(true);
  };

  const openEdit = (group: AlkesGroup) => {
    setForm({
      id: group.id,
      name: group.name,
      level: group.level as 1 | 2 | 3,
      parent_id: group.parent_id,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Nama kelompok wajib diisi');
      return;
    }
    if (form.level > 1 && !form.parent_id) {
      toast.error(`Level ${form.level} butuh kelompok induk`);
      return;
    }
    saveMutation.mutate();
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const l1 = flat.filter((g) => g.level === 1).length;
  const l2 = flat.filter((g) => g.level === 2).length;
  const l3 = flat.filter((g) => g.level === 3).length;

  const nodeMatchesSearch = (node: AlkesGroup): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    return !!node.children?.some((c) => nodeMatchesSearch(c));
  };

  const renderNode = (node: AlkesGroup, depth: number): React.ReactNode => {
    if (!nodeMatchesSearch(node)) return null;
    const cfg = LEVEL_CONFIG[node.level] ?? LEVEL_CONFIG[1];
    const hasChildren = !!node.children?.length;
    const isCollapsed = collapsed.has(node.id);
    const matched = search && node.name.toLowerCase().includes(search.toLowerCase());

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-slate-50 transition-colors group"
          style={{ paddingLeft: `${8 + depth * 24}px` }}
        >
          {/* Toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.id)}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors shrink-0"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
              />
            </button>
          ) : (
            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            </div>
          )}

          {/* Icon */}
          <div
            className={`w-7 h-7 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}
          >
            {hasChildren ? (
              isCollapsed ? (
                <Folder className={`w-3.5 h-3.5 ${cfg.color}`} />
              ) : (
                <FolderOpen className={`w-3.5 h-3.5 ${cfg.color}`} />
              )
            ) : (
              <Tag className={`w-3.5 h-3.5 ${cfg.color}`} />
            )}
          </div>

          {/* Name */}
          <span
            className={`flex-1 text-sm font-semibold truncate ${matched ? 'text-indigo-700 bg-indigo-50 px-1 rounded' : 'text-slate-800'}`}
          >
            {node.name}
          </span>

          {/* Badges */}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color} ${cfg.border} shrink-0 hidden sm:inline`}
          >
            L{node.level}
          </span>
          {node._count && node._count.alkes > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shrink-0 hidden sm:inline">
              {node._count.alkes}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {node.level < 3 && (
              <button
                type="button"
                onClick={() => openAdd((node.level + 1) as 2 | 3, node)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-100 transition-colors"
                title={`Tambah L${node.level + 1}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(node)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(node)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-rose-400 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div>{node.children?.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 pt-5 pb-4 px-4 sm:px-6 shadow-sm sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
              <Link href="/alkes" className="hover:text-indigo-600 transition-colors font-semibold">
                Alkes
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-800 font-bold">Kelompok</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Kelompok Alat Kesehatan
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Hierarki 3 level: Kategori → Sub Kategori → Item
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => openAdd(1, null)}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow font-bold gap-1.5 text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-6 mt-5 space-y-4">
        {/* Stat row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'Total',
              value: flat.length,
              color: 'text-slate-800',
              bg: 'bg-white',
              border: 'border-slate-200',
            },
            {
              label: 'Kategori (L1)',
              value: l1,
              color: 'text-indigo-700',
              bg: 'bg-indigo-50',
              border: 'border-indigo-200',
            },
            {
              label: 'Sub Kat (L2)',
              value: l2,
              color: 'text-purple-700',
              bg: 'bg-purple-50',
              border: 'border-purple-200',
            },
            {
              label: 'Item (L3)',
              value: l3,
              color: 'text-amber-700',
              bg: 'bg-amber-50',
              border: 'border-amber-200',
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} border ${s.border} rounded-2xl p-3 shadow-sm text-center`}
            >
              <p className={`text-2xl font-extrabold ${s.color}`}>{isLoading ? '—' : s.value}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-tight">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Tree */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kelompok..."
                className="h-9 w-full pl-9 pr-8 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-400 shrink-0">
              {flat.length} kelompok
            </span>
          </div>

          {/* Tree */}
          <div className="p-3">
            {isLoading && (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-9 bg-slate-100 rounded-xl animate-pulse"
                    style={{ marginLeft: `${(i % 3) * 24}px` }}
                  />
                ))}
              </div>
            )}
            {!isLoading && treeData.length === 0 && (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-7 h-7 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-500 text-sm">Belum ada kelompok</p>
                <p className="text-xs text-slate-400 mt-1">
                  Mulai dengan membuat Kategori Utama (Level 1)
                </p>
                <Button
                  onClick={() => openAdd(1, null)}
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Buat Kategori
                </Button>
              </div>
            )}
            {!isLoading && treeData.length > 0 && (
              <div className="space-y-0.5">{treeData.map((n) => renderNode(n, 0))}</div>
            )}
            {!isLoading &&
              search &&
              flat.filter((g) => g.name.toLowerCase().includes(search.toLowerCase())).length ===
                0 && (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Tidak ditemukan untuk "<strong>{search}</strong>"
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                {form.id ? (
                  <Pencil className="w-4 h-4 text-indigo-200" />
                ) : (
                  <Plus className="w-4 h-4 text-indigo-200" />
                )}
                {form.id ? 'Edit Kelompok' : 'Tambah Kelompok Baru'}
              </DialogTitle>
              <DialogDescription className="text-indigo-100 text-sm mt-1">
                Hierarki 3 level: Kategori → Sub Kategori → Item
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-5 bg-white">
            {/* Nama */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Nama Kelompok <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={
                  form.level === 1
                    ? 'Contoh: Alat Radiologi'
                    : form.level === 2
                      ? 'Contoh: X-Ray'
                      : 'Contoh: X-Ray Digital'
                }
                className="h-10 rounded-xl border-slate-200 focus-visible:ring-indigo-500 font-medium"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>

            {/* Level Selector — visual cards */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Level
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    level: 1,
                    label: 'Kategori',
                    desc: 'Level utama',
                    color: 'indigo',
                    emoji: '🔵',
                  },
                  { level: 2, label: 'Sub Kat.', desc: 'Turunan L1', color: 'purple', emoji: '🟣' },
                  { level: 3, label: 'Item', desc: 'Turunan L2', color: 'amber', emoji: '🟡' },
                ].map(({ level, label, desc, color, emoji }) => {
                  const active = form.level === level;
                  const disabled = !!form.id;
                  const colorMap: Record<string, string> = {
                    indigo: active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50',
                    purple: active
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50',
                    amber: active
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50',
                  };
                  return (
                    <button
                      key={level}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const lv = level as 1 | 2 | 3;
                        setForm((f) => ({
                          ...f,
                          level: lv,
                          parent_id: lv === 1 ? null : f.parent_id,
                        }));
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${colorMap[color]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="text-lg">{emoji}</span>
                      <span className="font-bold text-sm leading-tight">{label}</span>
                      <span
                        className={`text-[10px] leading-tight ${active ? 'text-white/80' : 'text-slate-400'}`}
                      >
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              {form.id && (
                <p className="text-[11px] text-slate-400">
                  ⚠ Level tidak dapat diubah setelah disimpan.
                </p>
              )}
            </div>

            {/* Parent picker */}
            {form.level > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Kelompok Induk <span className="text-rose-500">*</span>
                </Label>
                {parentOptions.length === 0 ? (
                  <div className="h-10 flex items-center px-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold gap-2">
                    ⚠ Buat Level {form.level - 1} terlebih dahulu
                  </div>
                ) : (
                  <Select
                    value={form.parent_id ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v || null }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200">
                      <SelectValue placeholder="— Pilih induk —" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-52">
                      {parentOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                                p.level === 1
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              L{p.level}
                            </span>
                            <span className="font-medium text-slate-800">{p.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Preview path */}
            {form.name.trim() && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 font-medium">
                <span className="shrink-0 text-slate-400">Path:</span>
                {form.parent_id && parentOptions.find((p) => p.id === form.parent_id) && (
                  <>
                    <span className="text-indigo-700 font-semibold">
                      {parentOptions.find((p) => p.id === form.parent_id)?.name}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                  </>
                )}
                <span className="text-slate-800 font-bold truncate">{form.name.trim()}</span>
              </div>
            )}
          </div>

          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-10 px-5 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saveMutation.isPending || !form.name.trim() || (form.level > 1 && !form.parent_id)
              }
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
            >
              {saveMutation.isPending ? 'Menyimpan...' : form.id ? '✓ Perbarui' : '+ Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="bg-rose-50 px-6 py-7 text-center border-b border-rose-100">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-rose-100">
              <Trash2 className="w-6 h-6 text-rose-500" />
            </div>
            <DialogTitle className="text-lg font-bold text-rose-900">Hapus Kelompok?</DialogTitle>
            <DialogDescription className="text-rose-700 font-medium mt-1.5 text-sm">
              "<strong className="text-rose-900">{deleteTarget?.name}</strong>" akan dihapus
              permanen. Kelompok yang memiliki alkes atau sub-kelompok tidak bisa dihapus.
            </DialogDescription>
          </div>
          <div className="px-5 py-4 bg-white border-t border-rose-100 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="h-10 px-5 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="h-10 px-5 rounded-xl font-bold"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
