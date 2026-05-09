'use client';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopbarRich } from '@/components/layout/TopbarRich';
import { useAuthHydrated, useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Tunggu sampai store selesai rehydrate dari localStorage agar tidak
    // keliru redirect ke /login saat user hanya me-refresh halaman.
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  // Saat belum hydrate, tampilkan placeholder ringan (hindari flash konten).
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#003ec7]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="min-h-screen overflow-auto md:ml-64">
        <TopbarRich />
        {children}
      </main>
    </div>
  );
}
