'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';

type Props = {
  q: string;
  courseId: string;
  courses: { id: string; name: string }[];
};

export function StudentFilterBar({ q, courseId, courses }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startT] = useTransition();

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete('page');
    startT(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Search */}
      <div className="relative max-w-sm min-w-[200px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          defaultValue={q}
          onChange={(e) => update('q', e.target.value)}
          placeholder="Tìm theo tên, email..."
          className="border-input bg-background focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
        />
      </div>

      {/* Course filter */}
      {courses.length > 0 && (
        <select
          value={courseId}
          onChange={(e) => update('courseId', e.target.value)}
          className="border-input bg-background focus:ring-ring h-9 rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">Tất cả khóa học</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
