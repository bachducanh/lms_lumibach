'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Search } from 'lucide-react';
import { ACTION_LABELS_VI } from '@/lib/activity-labels';
import { SimpleSelect } from '@/components/ui/select';
import type { ActivityAction } from '@lumibach/db';

type StudentOption = { id: string; name: string };
type CourseOption = { id: string; name: string };

type Props = {
  students?: StudentOption[];
  courses?: CourseOption[];
  showUser?: boolean;
  showCourse?: boolean;
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS_VI) as ActivityAction[];

export function ActivityLogFilter({
  students,
  courses,
  showUser = true,
  showCourse = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const val = (k: string) => searchParams.get(k) ?? '';

  return (
    <div className="flex flex-wrap gap-2">
      {/* Search (admin system log — free text user search) */}
      {showCourse && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            value={val('q')}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Tìm người dùng..."
            className="border-input bg-background focus:ring-ring h-9 w-44 rounded-md border pr-3 pl-8 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      )}

      {/* Student select (course log) */}
      {showUser && students && (
        <SimpleSelect
          aria-label="Lọc theo học sinh"
          value={val('userId')}
          onValueChange={(v) => update('userId', v)}
          options={[
            { value: '', label: '— Tất cả học sinh —' },
            ...students.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}

      {/* Course select (admin system log) */}
      {showCourse && courses && (
        <SimpleSelect
          aria-label="Lọc theo khoá học"
          value={val('courseId')}
          onValueChange={(v) => update('courseId', v)}
          options={[
            { value: '', label: '— Tất cả khoá học —' },
            ...courses.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      )}

      {/* Action type */}
      <SimpleSelect
        aria-label="Lọc theo hoạt động"
        value={val('action')}
        onValueChange={(v) => update('action', v)}
        options={[
          { value: '', label: '— Tất cả hoạt động —' },
          ...ALL_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS_VI[a] })),
        ]}
      />

      {/* Date from */}
      <input
        type="date"
        value={val('dateFrom')}
        onChange={(e) => update('dateFrom', e.target.value)}
        className="border-input bg-background focus:ring-ring h-9 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
      />

      {/* Date to */}
      <input
        type="date"
        value={val('dateTo')}
        onChange={(e) => update('dateTo', e.target.value)}
        className="border-input bg-background focus:ring-ring h-9 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
      />

      {/* Clear */}
      {(val('q') ||
        val('userId') ||
        val('courseId') ||
        val('action') ||
        val('dateFrom') ||
        val('dateTo')) && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="border-border bg-card hover:bg-muted h-9 rounded-md border px-3 text-sm transition-colors"
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
