import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { BookOpen, Code2, ClipboardList, FileQuestion, FileText, LogIn, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTION_LABELS_VI } from '@/lib/activity-labels';
import type { ActivityLogRow } from '@lumibach/types';
import type { ActivityAction } from '@lumibach/db';

// ── Action icon + color ────────────────────────────────────────

const ACTION_META: Record<
  ActivityAction,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  VIEW_LESSON: { icon: BookOpen, color: 'text-sky-400' },
  VIEW_COURSE: { icon: Eye, color: 'text-sky-400' },
  VIEW_ASSIGNMENT: { icon: FileText, color: 'text-amber-400' },
  VIEW_EXERCISE: { icon: Code2, color: 'text-violet-400' },
  START_QUIZ: { icon: ClipboardList, color: 'text-emerald-400' },
  SUBMIT_QUIZ: { icon: ClipboardList, color: 'text-emerald-400' },
  VIEW_PRACTICE_TEST: { icon: FileQuestion, color: 'text-cyan-400' },
  START_PRACTICE_TEST: { icon: FileQuestion, color: 'text-cyan-400' },
  SUBMIT_PRACTICE_TEST: { icon: FileQuestion, color: 'text-cyan-400' },
  SUBMIT_ASSIGNMENT: { icon: FileText, color: 'text-orange-400' },
  SUBMIT_CODE: { icon: Code2, color: 'text-violet-400' },
  LOGIN: { icon: LogIn, color: 'text-rose-400' },
};

type Props = {
  rows: ActivityLogRow[];
  showUser?: boolean;
  showCourse?: boolean;
};

export function ActivityLogTable({ rows, showUser = true, showCourse = false }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Chưa có hoạt động nào</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b">
            <th className="w-36 px-3 py-2 text-left font-medium">Thời gian</th>
            {showUser && <th className="px-3 py-2 text-left font-medium">Người dùng</th>}
            {showCourse && (
              <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">Khóa học</th>
            )}
            <th className="px-3 py-2 text-left font-medium">Hoạt động</th>
            <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Tài nguyên</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => {
            const meta = ACTION_META[row.action];
            const Icon = meta.icon;
            const name = row.user.fullName ?? `${row.user.firstName} ${row.user.lastName}`.trim();
            return (
              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                <td className="text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: vi })}
                </td>
                {showUser && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <p className="text-muted-foreground hidden truncate text-xs sm:block">
                          {row.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                )}
                {showCourse && (
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {row.course ? (
                      <span className="text-muted-foreground text-xs">{row.course.name}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
                    <span>{ACTION_LABELS_VI[row.action]}</span>
                  </div>
                </td>
                <td className="text-muted-foreground hidden max-w-[200px] truncate px-3 py-2.5 text-xs md:table-cell">
                  {row.resourceName ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
