'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NotificationBell } from '@/components/features/notifications/NotificationBell';
import { useSidebar } from '@/components/layouts/SidebarContext';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const SEGMENT_LABEL: Record<string, string> = {
  dashboard: 'Tổng quan',
  courses: 'Khóa học',
  assignments: 'Bài tập',
  students: 'Học sinh',
  users: 'Người dùng',
  'audit-logs': 'Nhật ký',
  settings: 'Cài đặt',
  quizzes: 'Quiz',
  lessons: 'Bài giảng',
  questions: 'Ngân hàng câu hỏi',
  modules: 'Nội dung',
  people: 'Thành viên',
  new: 'Tạo mới',
  edit: 'Chỉnh sửa',
  attempt: 'Làm bài',
  attempts: 'Bài làm',
  submissions: 'Bài nộp',
  security: 'Bảo mật',
  admin: 'Quản trị',
  gradebook: 'Bảng điểm',
  manage: 'Quản lý câu hỏi',
  notifications: 'Thông báo',
};

// Returns true if this segment looks like a database ID (cuid/uuid)
function isId(s: string) {
  return s.length > 20 || /^[a-z0-9]{20,}$/.test(s);
}

function buildCrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: string[] = ['LumiBach'];

  for (const seg of segments) {
    if (isId(seg)) continue;
    const label = SEGMENT_LABEL[seg];
    if (label && !crumbs.includes(label)) crumbs.push(label);
  }

  return crumbs;
}

export function Header({ showNotifications = true }: { showNotifications?: boolean }) {
  const pathname = usePathname();
  const [clientPathname, setClientPathname] = useState('');
  const { isCollapsed, toggle, toggleCollapsed } = useSidebar();

  useEffect(() => {
    setClientPathname(pathname);
  }, [pathname]);

  const crumbs = buildCrumbs(clientPathname);

  return (
    <header
      className="border-border bg-card/60 relative z-10 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6"
      style={{ boxShadow: '0 1px 0 0 oklch(1 0 0 / 5%)' }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={toggle}
        className="text-muted-foreground hover:bg-muted/40 hover:text-foreground -ml-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors md:hidden"
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={toggleCollapsed}
        className="text-muted-foreground hover:bg-muted/40 hover:text-foreground -ml-1 hidden h-9 w-9 items-center justify-center rounded-md transition-colors md:flex"
        title={isCollapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
        aria-label={isCollapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </button>

      {/* Breadcrumb — hidden on mobile, the page hero already shows context */}
      <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-xs font-medium select-none md:flex">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/30 shrink-0">/</span>}
            <span
              className={
                i === 0
                  ? 'text-primary/80 shrink-0 font-semibold'
                  : i === crumbs.length - 1
                    ? 'text-foreground truncate'
                    : 'text-muted-foreground/60 shrink-0'
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right controls */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showNotifications && <NotificationBell />}
        <ThemeToggle />
        <div className="bg-border hidden h-5 w-px sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
