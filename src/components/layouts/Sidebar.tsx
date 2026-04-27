'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  ChevronRight,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const mainNavItems: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Khóa học',  href: '/courses',   icon: BookOpen },
  { label: 'Bài tập',  href: '/assignments', icon: ClipboardList, roles: ['ADMIN', 'TEACHER', 'TA'] },
  { label: 'Học sinh',  href: '/students',   icon: GraduationCap, roles: ['ADMIN', 'TEACHER', 'TA'] },
];

const adminNavItems: NavItem[] = [
  { label: 'Người dùng', href: '/admin/users',       icon: Users,       roles: ['ADMIN'] },
  { label: 'Nhật ký',    href: '/admin/audit-logs',  icon: ScrollText,  roles: ['ADMIN'] },
];

const bottomNavItems: NavItem[] = [
  { label: 'Cài đặt', href: '/settings/security', icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN:   'Quản trị viên',
  TEACHER: 'Giáo viên',
  TA:      'Trợ giảng',
  STUDENT: 'Học sinh',
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-primary/15 text-sidebar-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-150', isActive ? '' : 'group-hover:scale-110')} />
      <span className="flex-1">{item.label}</span>
      {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const user = session?.user;

  const visibleMain  = mainNavItems.filter(i => !i.roles || (role && i.roles.includes(role)));
  const visibleAdmin = adminNavItems.filter(i => !i.roles || (role && i.roles.includes(role)));

  return (
    <aside className="flex h-full w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/LumiBach_firstLogo.png"
            alt="LumiBach"
            width={26}
            height={26}
            className="shrink-0 rounded-sm"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-sidebar-foreground">LumiBach</span>
            <span className="text-[10px] text-sidebar-foreground/40 tracking-wider uppercase">Learning</span>
          </div>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleMain.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {visibleAdmin.length > 0 && (
          <>
            <div className="my-3 flex items-center gap-2 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Quản trị</span>
              <div className="flex-1 h-px bg-sidebar-border" />
            </div>
            {visibleAdmin.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3 space-y-0.5">
        {bottomNavItems.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* User profile */}
        {user && (
          <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
              {(user.name ?? user.email ?? '?')[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                {user.name ?? user.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40">
                {role ? ROLE_LABEL[role] ?? role : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
