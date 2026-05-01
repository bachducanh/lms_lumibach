'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { UserMenu } from '@/components/features/auth/UserMenu';

const SEGMENT_LABEL: Record<string, string> = {
  dashboard:    'Tổng quan',
  courses:      'Khóa học',
  assignments:  'Bài tập',
  students:     'Học sinh',
  users:        'Người dùng',
  'audit-logs': 'Nhật ký',
  settings:     'Cài đặt',
  quizzes:      'Quiz',
  lessons:      'Bài giảng',
  questions:    'Ngân hàng câu hỏi',
  modules:      'Nội dung',
  people:       'Thành viên',
  new:          'Tạo mới',
  edit:         'Chỉnh sửa',
  attempt:      'Làm bài',
  attempts:     'Bài làm',
  submissions:  'Bài nộp',
  security:     'Bảo mật',
  admin:        'Quản trị',
  gradebook:    'Bảng điểm',
  manage:       'Quản lý câu hỏi',
};

// Returns true if this segment looks like a database ID (cuid/uuid)
function isId(s: string) {
  return s.length > 20 || /^[a-z0-9]{20,}$/.test(s);
}

export function Header() {
  const pathname = usePathname();

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
      className="flex h-14 shrink-0 items-center border-b border-border bg-card/60 backdrop-blur-md px-6 gap-3"
      style={{ boxShadow: '0 1px 0 0 oklch(1 0 0 / 5%)' }}
    >
      {/* Breadcrumb */}
      <div className="flex-1 flex items-center gap-1.5 text-xs font-medium select-none min-w-0">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-muted-foreground/30 shrink-0">/</span>}
            <span className={
              i === 0
                ? 'text-primary/80 font-semibold shrink-0'
                : i === crumbs.length - 1
                ? 'text-foreground truncate'
                : 'text-muted-foreground/60 shrink-0'
            }>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <div className="h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
