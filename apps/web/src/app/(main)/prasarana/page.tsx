'use client';

import { Building2 } from 'lucide-react';

export default function PrasaranaPage() {
  return (
    <div>
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eff4ff] to-[#dde1ff] text-[#003ec7]">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="font-semibold text-2xl text-slate-900 tracking-tight">
            Manajemen Prasarana
          </h1>
          <p className="mt-2 text-slate-500 text-sm">
            Modul prasarana sedang dalam pengembangan. Daftar, detail, serta pengelolaan prasarana
            fasilitas kesehatan akan tersedia di rilis berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
}
