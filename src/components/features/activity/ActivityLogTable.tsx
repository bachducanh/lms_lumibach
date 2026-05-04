import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { BookOpen, Code2, ClipboardList, FileText, LogIn, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTION_LABELS } from '@/lib/activity-labels';
import type { ActivityLogRow } from '@/actions/activity';
import type { ActivityAction } from '@prisma/client';

// ── Action icon + color ────────────────────────────────────────

const ACTION_META: Record<ActivityAction, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  VIEW_LESSON:       { icon: BookOpen,      color: 'text-sky-400' },
  VIEW_COURSE:       { icon: Eye,           color: 'text-sky-400' },
  VIEW_ASSIGNMENT:   { icon: FileText,      color: 'text-amber-400' },
  VIEW_EXERCISE:     { icon: Code2,         color: 'text-violet-400' },
  START_QUIZ:        { icon: ClipboardList, color: 'text-emerald-400' },
  SUBMIT_QUIZ:       { icon: ClipboardList, color: 'text-emerald-400' },
  SUBMIT_ASSIGNMENT: { icon: FileText,      color: 'text-orange-400' },
  SUBMIT_CODE:       { icon: Code2,         color: 'text-violet-400' },
  LOGIN:             { icon: LogIn,         color: 'text-rose-400' },
};

type Props = {
  rows:       ActivityLogRow[];
  showUser?:  boolean;
  showCourse?: boolean;
};

export function ActivityLogTable({ rows, showUser = true, showCourse = false }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Chưa có hoạt động nào</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium w-36">Thời gian</th>
            {showUser  && <th className="text-left py-2 px-3 font-medium">Người dùng</th>}
            {showCourse && <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Khóa học</th>}
            <th className="text-left py-2 px-3 font-medium">Hoạt động</th>
            <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Tài nguyên</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const meta = ACTION_META[row.action];
            const Icon = meta.icon;
            const name = row.user.fullName ?? `${row.user.firstName} ${row.user.lastName}`.trim();
            return (
              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: vi })}
                </td>
                {showUser && (
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-muted-foreground text-xs truncate hidden sm:block">{row.user.email}</p>
                      </div>
                    </div>
                  </td>
                )}
                {showCourse && (
                  <td className="py-2.5 px-3 hidden lg:table-cell">
                    {row.course ? (
                      <span className="text-xs text-muted-foreground">{row.course.name}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
                    <span>{ACTION_LABELS[row.action]}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell text-muted-foreground text-xs truncate max-w-[200px]">
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
