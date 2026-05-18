'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NotificationBell } from '@/components/features/notifications/NotificationBell';
import { useSidebar } from '@/components/layouts/SidebarContext';
import { Menu } from 'lucide-react';

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

export function Header({ showNotifications = true }: { showNotifications?: boolean }) {
  const pathname = usePathname();
  const { toggle } = useSidebar();

  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb: skip ID segments, map known labels
  const crumbs: string[] = ['LumiBach'];
  for (const seg of segments) {
    if (isId(seg)) continue;
    const label = SEGMENT_LABEL[seg];
    if (label && !crumbs.includes(label)) crumbs.push(label);
  }

  return (
    <header
      className="border-border bg-card/60 relative z-10 flex h-14 shrink-0 items-center gap-3 border-b px-6 backdrop-blur-md"
      style={{ boxShadow: '0 1px 0 0 oklch(1 0 0 / 5%)' }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={toggle}
        className="text-muted-foreground hover:bg-muted/40 hover:text-foreground mr-1 -ml-1 flex h-8 w-8 items-center justify-center rounded-md transition-colors md:hidden"
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium select-none">
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
      <div className="flex shrink-0 items-center gap-2">
        {showNotifications && <NotificationBell />}
        <ThemeToggle />
        <div className="bg-border h-5 w-px" />
        <UserMenu />
      </div>
    </header>
  );
}
