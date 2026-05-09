'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthHydrated, useAuthStore } from '@/stores/authStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthHydrated();
  const [loading, setLoading] = useState(false);

  // Jika user sudah login (setelah store rehydrate), redirect sesuai role.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (user?.role === 'STAFF') {
      router.replace('/alkes');
      return;
    }
    router.replace('/dashboard');
  }, [hydrated, isAuthenticated, router, user?.role]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const {
        user: loggedInUser,
        accessToken,
        refreshToken,
      } = res.data.data as {
        user: {
          id: string;
          name: string;
          email: string;
          role: 'ADMIN' | 'MANAGER' | 'STAFF';
          avatar_url: string | null;
          assigned_room_id?: string | null;
          assigned_room?: {
            id: string;
            name: string;
            level: number;
          } | null;
        };
        accessToken: string;
        refreshToken: string;
      };

      setUser(loggedInUser, accessToken, refreshToken);
      toast.success(`Selamat datang, ${loggedInUser.name}!`);

      if (loggedInUser.role === 'STAFF') {
        router.push('/alkes');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login gagal';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            A
          </div>
          <CardTitle className="text-2xl font-bold">Manajemen Alkes</CardTitle>
          <CardDescription>
            Sistem Inventarisasi Alat Kesehatan & Prasarana Puskesmas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@alkes.id" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Masuk...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
