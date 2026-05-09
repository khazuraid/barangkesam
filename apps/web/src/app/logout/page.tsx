'use client';

import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const run = async () => {
      try {
        await api.post('/auth/logout');
      } catch {
        // ignore, tetap lanjut clear session lokal
      } finally {
        logout();
        router.replace('/login');
      }
    };

    void run();
  }, [logout, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
        Sedang logout...
      </div>
    </div>
  );
}
