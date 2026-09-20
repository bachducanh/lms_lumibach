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
  ACTIVE:
    'border border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  INACTIVE: 'border border-border bg-muted text-muted-foreground',
  SUSPENDED:
    'border border-red-600/25 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  PENDING:
    'border border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
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
      <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-5 py-16 text-center">
        <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-lg">
          <UserX className="h-6 w-6" />
        </div>
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
    <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-border border-b">
            <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold">
              Học sinh
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold md:table-cell">
              Email
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold sm:table-cell">
              Trạng thái
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold sm:table-cell">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Lớp
              </span>
            </th>
            <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold lg:table-cell">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Đăng nhập gần nhất
              </span>
            </th>
            <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {displayName(s).split(' ').pop()?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="leading-tight font-medium">{displayName(s)}</p>
                    {s.username && <p className="text-muted-foreground text-xs">@{s.username}</p>}
                    <p className="text-muted-foreground text-xs break-all md:hidden">{s.email}</p>
                    <span
                      className={cn(
                        'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap sm:hidden',
                        STATUS_CLASS[s.status] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
              </td>
              <td className="text-muted-foreground hidden px-4 py-3.5 md:table-cell">{s.email}</td>
              <td className="hidden px-4 py-3.5 sm:table-cell">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
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
                  className="border-border bg-card hover:bg-accent inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors"
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
