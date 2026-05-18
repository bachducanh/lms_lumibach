'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Radio, ScrollText, Target, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = {
  segment: string;
  label: string;
  icon: typeof ScrollText;
  description: string;
};

const TABS: Tab[] = [
  {
    segment: 'competency',
    label: 'Phân tích năng lực',
    icon: Target,
    description: 'Chuẩn đầu ra và kỹ năng đạt được',
  },
  {
    segment: 'logs',
    label: 'Logs',
    icon: ScrollText,
    description: 'Lịch sử nhấn chuột, thời gian và hoạt động',
  },
  {
    segment: 'live-logs',
    label: 'Live logs',
    icon: Radio,
    description: 'Hoạt động đang diễn ra theo thời gian thực',
  },
  {
    segment: 'activity',
    label: 'Báo cáo hoạt động',
    icon: Activity,
    description: 'Tổng lượt xem và lượt tương tác theo tài liệu',
  },
  {
    segment: 'participation',
    label: 'Tham gia khóa học',
    icon: Users,
    description: 'Ai đã hoặc chưa xem một nội dung cụ thể',
  },
];

export function ReportsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <div className="border-border border-b">
      <nav className="-mb-px flex flex-wrap gap-1">
        {TABS.map((t) => {
          const href = `/courses/${slug}/reports/${t.segment}`;
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          const Icon = t.icon;
          return (
            <Link
              key={t.segment}
              href={href}
              className={cn(
                'group inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:border-border hover:text-foreground border-transparent'
              )}
              title={t.description}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground/70'
                )}
              />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
