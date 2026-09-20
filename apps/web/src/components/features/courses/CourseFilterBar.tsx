'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryTreePicker } from '@/components/features/categories/CategoryTreePicker';
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
  const currentCategoryId = sp.get('categoryId') ?? null;
  const showStatusFilter = role === 'ADMIN' || role === 'TEACHER' || role === 'TA';

  useEffect(() => {
    setQ(sp.get('q') ?? '');
  }, [sp]);

  // Debounce search
  useEffect(() => {
    const currentQ = sp.get('q') ?? '';
    if (q === currentQ) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set('q', q);
      else params.delete('q');
      params.delete('page');
      startTransition(() => router.push(`/courses?${params.toString()}`));
    }, 350);
    return () => clearTimeout(timer);
  }, [q, router, sp, startTransition]);

  function handleStatus(val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set('status', val);
    else params.delete('status');
    params.delete('page');
    startTransition(() => router.push(`/courses?${params.toString()}`));
  }

  function handleCategory(id: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (id) {
      params.set('categoryId', id);
      params.set('includeSubcategories', 'true');
    } else {
      params.delete('categoryId');
      params.delete('includeSubcategories');
    }
    params.delete('page');
    startTransition(() => router.push(`/courses?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Tìm khoá học..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-input bg-card placeholder:text-muted-foreground focus:ring-ring/40 focus:border-ring h-10 w-64 rounded-full border pr-4 pl-9 text-sm transition-colors focus:ring-2 focus:outline-none"
        />
      </div>

      {/* Category picker */}
      <div className="w-56">
        <CategoryTreePicker
          value={currentCategoryId}
          onChange={handleCategory}
          leafOnly={false}
          allowClear
          placeholder="Lọc theo danh mục"
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
                'h-9 rounded-full border px-4 text-sm font-medium transition-colors duration-150',
                currentStatus === chip.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-foreground/40'
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
