'use client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Jika diisi, hanya role dalam list yang bisa melihat menu ini. */
  roles?: UserRole[];
};

const ADMIN_ONLY: UserRole[] = ['ADMIN'];

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/alkes', label: 'Alkes', icon: 'medical_services' },
  { href: '/pengajuan', label: 'Pengajuan Barang', icon: 'assignment' },
  { href: '/inventaris', label: 'Inventaris Barang', icon: 'inventory_2' },
  {
    href: '/verifikasi/alkes',
    label: 'Verifikasi Alkes',
    icon: 'fact_check',
    roles: ADMIN_ONLY,
  },
  { href: '/kelompok/alkes', label: 'Ruangan', icon: 'meeting_room', roles: ADMIN_ONLY },
  {
    href: '/manajemen-akun',
    label: 'Manajemen Akun',
    icon: 'manage_accounts',
    roles: ADMIN_ONLY,
  },
];

const bottomNavItems: NavItem[] = [
  { href: '/import', label: 'Import', icon: 'file_upload', roles: ADMIN_ONLY },
  { href: '/export', label: 'Export', icon: 'file_download', roles: ADMIN_ONLY },
  { href: '/logs', label: 'Activity Logs', icon: 'history', roles: ADMIN_ONLY },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const footerNavItems: NavItem[] = [
  { href: '/support', label: 'Support', icon: 'help' },
  { href: '/logout', label: 'Sign Out', icon: 'logout' },
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role) as UserRole | undefined;

  const canView = (item: NavItem) => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role);
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-xl font-[family-name:var(--font-plus-jakarta)] text-sm transition-all duration-300 ease-out hover:translate-x-1',
          active
            ? 'bg-blue-50/50 dark:bg-blue-900/20 text-[#003ec7] dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 font-medium',
        )}
      >
        <span
          className="material-symbols-outlined text-xl"
          style={
            active
              ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
              : undefined
          }
        >
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3 mb-6 px-4 py-6">
        <div className="w-10 h-10 rounded-lg bg-[#003ec7] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
          <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-plus-jakarta)]">
            MedAsset AI
          </h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium font-[family-name:var(--font-plus-jakarta)]">
            Asset Management
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {mainNavItems.filter(canView).map((item) => renderNavLink(item))}
        {bottomNavItems.filter(canView).map((item) => renderNavLink(item))}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-200/50 dark:border-slate-800/50 px-3 space-y-1 pb-4">
        {footerNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-[family-name:var(--font-plus-jakarta)] text-sm font-medium transition-all duration-300 ease-out hover:translate-x-1 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
