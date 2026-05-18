'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

type Props = { role: UserRole };

const STATUS_CHIPS = [
  { value: '', label: 'Tất cả' },
  { value: 'PUBLISHED', label: 'Đang mở' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
];

export function CourseFilterBar({ role }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const currentStatus = sp.get('status') ?? '';
  const showStatusFilter = role === 'ADMIN' || role === 'TEACHER' || role === 'TA';

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set('q', q);
      else params.delete('q');
      params.delete('page');
      startTransition(() => router.push(`/courses?${params.toString()}`));
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  function handleStatus(val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set('status', val);
    else params.delete('status');
    params.delete('page');
    startTransition(() => router.push(`/courses?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Tìm khoá học..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring focus:border-primary/50 h-9 w-56 rounded-full border pr-3 pl-8 text-sm transition-colors focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Status pill chips */}
      {showStatusFilter && (
        <div className="flex items-center gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleStatus(chip.value)}
              className={cn(
                'h-8 rounded-full px-4 text-sm font-medium transition-all duration-150',
                currentStatus === chip.value
                  ? 'bg-primary text-primary-foreground shadow-primary/30 shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
