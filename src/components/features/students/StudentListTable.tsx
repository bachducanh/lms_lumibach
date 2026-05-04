'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { UserCheck, UserX, Clock, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentRow } from '@/actions/students';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Hoạt động',
  INACTIVE:  'Không hoạt động',
  SUSPENDED: 'Bị khóa',
  PENDING:   'Chờ kích hoạt',
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE:    'bg-green-500/10 text-green-700 dark:text-green-400',
  INACTIVE:  'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-red-500/10 text-destructive',
  PENDING:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

function displayName(s: StudentRow) {
  return s.fullName || `${s.firstName} ${s.lastName}`.trim();
}

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });
}

type Props = {
  students: StudentRow[];
};

export function StudentListTable({ students }: Props) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 gap-3">
        <UserX className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Không tìm thấy học sinh nào</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              Học sinh
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">
              Email
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              Trạng thái
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Lớp</span>
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Đăng nhập gần nhất</span>
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {displayName(s).split(' ').pop()?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{displayName(s)}</p>
                    {s.username && (
                      <p className="text-[11px] text-muted-foreground">@{s.username}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground md:hidden">{s.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">
                {s.email}
              </td>
              <td className="px-4 py-3.5">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATUS_CLASS[s.status] ?? 'bg-muted text-muted-foreground',
                )}>
                  {s.status === 'ACTIVE' ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </td>
              <td className="px-4 py-3.5 hidden sm:table-cell">
                <span className="tabular-nums text-sm font-medium">{s._count.enrollments}</span>
                <span className="text-muted-foreground text-xs ml-1">lớp</span>
              </td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                {fmtDate(s.lastLoginAt)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <Link
                  href={`/students/${s.id}`}
                  className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  Chi tiết
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
