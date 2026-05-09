'use client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

export function Header({ title }: { title?: string }) {
  const router = useRouter();
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
          {user?.role}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-600 text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>Pengaturan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/logout')} className="text-red-600">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
