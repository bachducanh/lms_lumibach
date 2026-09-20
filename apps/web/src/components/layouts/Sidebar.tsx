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
  DoorOpen,
  Terminal,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings,
  Users,
  BarChart3,
  FolderTree,
  Trash2,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  adminHref?: string;
  activeHrefs?: string[];
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const mainNavItems: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Khóa học', href: '/courses', icon: BookOpen },
  { label: 'Sandbox', href: '/sandbox', icon: Terminal },
  { label: 'Học sinh', href: '/students', icon: GraduationCap, roles: ['ADMIN', 'TEACHER', 'TA'] },
  {
    label: 'Ngân hàng chung',
    href: '/question-banks',
    icon: Library,
    roles: ['ADMIN', 'TEACHER'],
  },
  {
    label: 'Phòng chức năng',
    href: '/rooms',
    adminHref: '/admin/rooms',
    activeHrefs: ['/rooms', '/admin/rooms'],
    icon: DoorOpen,
    roles: ['ADMIN', 'TEACHER', 'TA'],
  },
];

const adminNavItems: NavItem[] = [
  { label: 'Người dùng', href: '/admin/users', icon: Users, roles: ['ADMIN'] },
  { label: 'Danh mục khoá học', href: '/admin/categories', icon: FolderTree, roles: ['ADMIN'] },
  { label: 'Phân tích', href: '/admin/analytics', icon: BarChart3, roles: ['ADMIN'] },
  { label: 'Nhật ký hoạt động', href: '/admin/audit-logs', icon: ScrollText, roles: ['ADMIN'] },
  { label: 'Thùng rác', href: '/admin/trash', icon: Trash2, roles: ['ADMIN'] },
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

function NavLink({
  item,
  pathname,
  collapsed,
  role,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  role?: string;
}) {
  const Icon = item.icon;
  const href = role === 'ADMIN' && item.adminHref ? item.adminHref : item.href;
  const activeHrefs = item.activeHrefs ?? [href];
  const isActive = activeHrefs.some(
    (activeHref) => pathname === activeHref || pathname.startsWith(activeHref + '/')
  );

  return (
    <Link
      href={href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors duration-150',
        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        isActive
          ? 'bg-sidebar-primary/10 text-sidebar-accent-foreground font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      {/* Vạch nhấn bên trái cho mục đang chọn */}
      {isActive && (
        <span className="bg-sidebar-primary absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
      )}

      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70'
        )}
      />

      {!collapsed && <span className="flex-1">{item.label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, isCollapsed, close } = useSidebar();
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
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
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
          'md:relative md:translate-x-0 md:transition-[width]',
          isCollapsed ? 'md:w-16' : 'md:w-60'
        )}
        aria-label="Điều hướng chính"
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'border-sidebar-border flex h-16 shrink-0 items-center border-b px-4',
            isCollapsed && 'md:justify-center md:px-2'
          )}
        >
          <Link
            href="/dashboard"
            aria-label="LumiBach — Tổng quan"
            className={cn('flex items-center gap-2.5', isCollapsed && 'md:gap-0')}
          >
            {/* Ảnh logo có nền trắng: multiply cho nền trắng "biến mất" ở theme sáng,
                theme tối đặt trong ô trắng bo góc. */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg dark:bg-white dark:p-0.5">
              <Image
                src="/icon.png"
                alt=""
                width={36}
                height={36}
                priority
                className="h-full w-full mix-blend-multiply dark:mix-blend-normal"
              />
            </span>

            <div className={cn('flex flex-col leading-none', isCollapsed && 'md:hidden')}>
              <span className="font-heading text-sidebar-accent-foreground text-lg font-bold tracking-tight">
                LumiBach
              </span>
              <span className="text-sidebar-foreground/70 mt-1 text-[10px] font-semibold tracking-[0.2em] uppercase">
                Learn
              </span>
            </div>
          </Link>
        </div>

        {/* ── Main nav ─────────────────────────────────────────── */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleMain.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={isCollapsed}
              role={role}
            />
          ))}

          {visibleAdmin.length > 0 && (
            <>
              {/* Section divider */}
              <div className={cn('my-4 flex items-center gap-2 px-3', isCollapsed && 'md:px-1')}>
                <span className="text-sidebar-foreground/85 text-[11px] font-semibold tracking-[0.14em] uppercase">
                  {isCollapsed ? '' : 'Quản trị'}
                </span>
                <div className="bg-sidebar-border h-px flex-1" />
              </div>
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={isCollapsed}
                  role={role}
                />
              ))}
            </>
          )}
        </nav>

        {/* ── Bottom section ───────────────────────────────────── */}
        <div
          className={cn(
            'border-sidebar-border shrink-0 space-y-1 border-t px-3 py-3',
            isCollapsed && 'md:px-2'
          )}
        >
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={isCollapsed}
              role={role}
            />
          ))}

          {/* User profile card */}
          {user && (
            <div
              className={cn(
                'bg-sidebar-accent mt-2 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5',
                isCollapsed && 'md:justify-center md:px-2'
              )}
              title={isCollapsed ? (user.name ?? user.email ?? '') : undefined}
            >
              <div className="bg-sidebar-primary/10 text-sidebar-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {initials}
              </div>

              <div className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
                <p className="text-sidebar-accent-foreground truncate text-xs font-semibold">
                  {user.name ?? user.email}
                </p>
                <p className="text-sidebar-foreground/85 text-[11px]">
                  {role ? (ROLE_LABEL[role] ?? role) : ''}
                </p>
              </div>

              {/* Trạng thái trực tuyến */}
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full bg-emerald-500',
                  isCollapsed && 'md:hidden'
                )}
                aria-hidden
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
