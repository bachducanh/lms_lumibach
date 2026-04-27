'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import type { UserRole } from '@prisma/client';

type Props = { role: UserRole };

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PUBLISHED', label: 'Đang mở' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
];

export function CourseFilterBar({ role }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set('q', q); else params.delete('q');
      params.delete('page');
      startTransition(() => router.push(`/courses?${params.toString()}`));
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  function handleStatus(val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set('status', val); else params.delete('status');
    params.delete('page');
    startTransition(() => router.push(`/courses?${params.toString()}`));
  }

  const showStatusFilter = role === 'ADMIN' || role === 'TEACHER';

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Tìm khoá học..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-9 min-w-52 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {showStatusFilter && (
        <select
          value={sp.get('status') ?? ''}
          onChange={(e) => handleStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground dark:bg-card"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
