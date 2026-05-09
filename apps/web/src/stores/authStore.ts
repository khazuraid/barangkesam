import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AssignedRoom {
  id: string;
  name: string;
  level: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  avatar_url: string | null;
  assigned_room_id?: string | null;
  assigned_room?: AssignedRoom | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

/**
 * BUG-08 FIX: Simpan SEMUA state (user, tokens, isAuthenticated) di localStorage
 * via Zustand persist agar konsisten antar tab dan setelah refresh.
 * Tidak lagi split antara sessionStorage dan localStorage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-store',
      // Simpan semua field termasuk token
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);

/**
 * Hook untuk mengetahui apakah store auth sudah selesai rehydrate dari localStorage.
 * Mencegah race-condition: sebelum hydrate selesai, `isAuthenticated` bernilai default (false)
 * sehingga halaman yang memerlukan auth akan keliru redirect ke /login saat refresh.
 *
 * Saat SSR / render pertama di client, kembalikan `false` agar UI menunggu hingga
 * `useEffect` menyelesaikan sinkronisasi dari localStorage.
 *
 * Gunakan: const hydrated = useAuthHydrated();
 * if (!hydrated) return null; // atau skeleton
 */
export function useAuthHydrated(): boolean {
  // Selalu mulai dari `false` untuk menghindari mismatch SSR/hydration dan kasus
  // di mana `useAuthStore.persist` belum siap pada evaluasi awal modul.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useAuthStore.persist;
    if (!persistApi) {
      // Fallback: tanpa persist API yang tersedia, anggap sudah "hydrated"
      // agar aplikasi tidak stuck di loading state.
      setHydrated(true);
      return;
    }

    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }

    const unsub = persistApi.onFinishHydration(() => setHydrated(true));
    return () => {
      unsub();
    };
  }, []);

  return hydrated;
}
