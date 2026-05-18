'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { UserCheck, UserX, Clock, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentRow } from '@lumibach/types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Không hoạt động',
  SUSPENDED: 'Bị khóa',
  PENDING: 'Chờ kích hoạt',
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-700 dark:text-green-400',
  INACTIVE: 'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-red-500/10 text-destructive',
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

function displayName(s: StudentRow) {
  return s.fullName || `${s.firstName} ${s.lastName}`.trim() || s.email;
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—';
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });
}

type Props = {
  students: StudentRow[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function StudentListTable({ students, emptyTitle, emptyDescription }: Props) {
  if (students.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border px-5 py-16 text-center">
        <UserX className="text-muted-foreground/40 h-10 w-10" />
        <div>
          <p className="font-medium">{emptyTitle ?? 'Không tìm thấy học sinh nào'}</p>
          {emptyDescription && (
            <p className="text-muted-foreground mt-1 max-w-md text-sm">{emptyDescription}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-border border-b">
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
              Học sinh
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase md:table-cell">
              Email
            </th>
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
              Trạng thái
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase sm:table-cell">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Lớp
              </span>
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase lg:table-cell">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Đăng nhập gần nhất
              </span>
            </th>
            <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {displayName(s).split(' ').pop()?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="leading-tight font-medium">{displayName(s)}</p>
                    {s.username && (
                      <p className="text-muted-foreground text-[11px]">@{s.username}</p>
                    )}
                    <p className="text-muted-foreground text-[11px] md:hidden">{s.email}</p>
                  </div>
                </div>
              </td>
              <td className="text-muted-foreground hidden px-4 py-3.5 md:table-cell">{s.email}</td>
              <td className="px-4 py-3.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    STATUS_CLASS[s.status] ?? 'bg-muted text-muted-foreground'
                  )}
                >
                  {s.status === 'ACTIVE' ? (
                    <UserCheck className="h-3 w-3" />
                  ) : (
                    <UserX className="h-3 w-3" />
                  )}
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </td>
              <td className="hidden px-4 py-3.5 sm:table-cell">
                <span className="text-sm font-medium tabular-nums">{s._count.enrollments}</span>
                <span className="text-muted-foreground ml-1 text-xs"> lớp</span>
              </td>
              <td className="text-muted-foreground hidden px-4 py-3.5 text-xs lg:table-cell">
                {fmtDate(s.lastLoginAt)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <Link
                  href={`/students/${s.id}`}
                  className="border-border bg-card hover:bg-accent inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
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
