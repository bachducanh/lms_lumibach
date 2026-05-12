'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import {
  BookOpen,
  Terminal,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Activity,
  Settings,
  Users,
  ChevronRight,
  Zap,
  BarChart3,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const mainNavItems: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Khóa học', href: '/courses', icon: BookOpen },
  { label: 'Sandbox', href: '/sandbox', icon: Terminal },
  { label: 'Học sinh', href: '/students', icon: GraduationCap, roles: ['ADMIN', 'TEACHER', 'TA'] },
];

const adminNavItems: NavItem[] = [
  { label: 'Người dùng', href: '/admin/users', icon: Users, roles: ['ADMIN'] },
  { label: 'Phân tích', href: '/admin/analytics', icon: BarChart3, roles: ['ADMIN'] },
  { label: 'Nhật ký hệ thống', href: '/admin/logs', icon: Activity, roles: ['ADMIN'] },
  { label: 'Audit log', href: '/admin/audit-logs', icon: ScrollText, roles: ['ADMIN'] },
];

const bottomNavItems: NavItem[] = [
  { label: 'Cài đặt', href: '/settings/security', icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  TA: 'Trợ giảng',
  STUDENT: 'Học sinh',
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-sidebar-primary/15 text-sidebar-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      {/* Active indicator — Unity-style left bar */}
      {isActive && (
        <span
          className="bg-sidebar-primary absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ boxShadow: '0 0 8px rgb(253 8 93 / 70%)' }}
        />
      )}

      {/* Icon with glow when active */}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-all duration-200',
          isActive ? 'drop-shadow-[0_0_6px_oklch(0.68_0.195_35_/_0.8)]' : 'group-hover:scale-110'
        )}
      />

      <span className="flex-1 tracking-wide">{item.label}</span>

      {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, close } = useSidebar();
  const role = session?.user?.role;
  const user = session?.user;

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    close();
  }, [pathname, close]);

  const visibleMain = mainNavItems.filter((i) => !i.roles || (role && i.roles.includes(role)));
  const visibleAdmin = adminNavItems.filter((i) => !i.roles || (role && i.roles.includes(role)));

  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'bg-sidebar border-sidebar-border flex h-full w-60 flex-col border-r',
          // Mobile: fixed overlay, slides in/out
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible in normal flow
          'md:relative md:translate-x-0 md:transition-none'
        )}
        style={{ boxShadow: '1px 0 0 0 oklch(1 0 0 / 5%)' }}
        aria-label="Điều hướng chính"
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="border-sidebar-border flex h-14 shrink-0 items-center border-b px-4">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            {/* Logo icon with glow */}
            <div className="relative shrink-0">
              <div className="bg-sidebar-primary absolute inset-0 rounded-sm opacity-0 blur-[6px] transition-opacity duration-300 group-hover:opacity-20" />
              <Image
                src="/LumiBach_firstLogo.png"
                alt="LumiBach"
                width={28}
                height={28}
                className="relative shrink-0 rounded-sm"
              />
            </div>

            <div className="flex flex-col leading-none">
              <span className="text-sidebar-foreground text-sm font-bold tracking-wide">
                LumiBach
              </span>
              <span className="text-sidebar-primary flex items-center gap-1 text-[9px] font-semibold tracking-[0.15em] uppercase">
                <Zap className="h-2 w-2" />
                Learn
              </span>
            </div>
          </Link>
        </div>

        {/* ── Main nav ─────────────────────────────────────────── */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleMain.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {visibleAdmin.length > 0 && (
            <>
              {/* Section divider */}
              <div className="my-4 flex items-center gap-2 px-3">
                <span className="text-sidebar-foreground/60 text-[10px] font-bold tracking-[0.2em] uppercase">
                  Quản trị
                </span>
                <div className="bg-sidebar-foreground/10 h-px flex-1" />
              </div>
              {visibleAdmin.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          )}
        </nav>

        {/* ── Bottom section ───────────────────────────────────── */}
        <div className="border-sidebar-border shrink-0 space-y-0.5 border-t px-3 py-3">
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {/* User profile card */}
          {user && (
            <div className="hover:bg-sidebar-accent mt-2 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors">
              {/* Avatar with orange ring */}
              <div
                className="text-sidebar-primary bg-sidebar-primary/20 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ boxShadow: '0 0 0 1.5px rgb(253 8 93 / 50%)' }}
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sidebar-foreground truncate text-xs font-semibold">
                  {user.name ?? user.email}
                </p>
                <p className="text-sidebar-foreground/40 text-[10px] tracking-wide">
                  {role ? (ROLE_LABEL[role] ?? role) : ''}
                </p>
              </div>

              {/* Online indicator */}
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                style={{ boxShadow: '0 0 6px oklch(0.70 0.18 140 / 0.7)' }}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
