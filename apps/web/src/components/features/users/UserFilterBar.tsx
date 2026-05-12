'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';

type Props = {
  q: string;
  role: string;
  status: string;
};

export function UserFilterBar({ q, role, status }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(overrides: Partial<{ q: string; role: string; status: string }>) {
    const next = { q, role, status, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.role) params.set('role', next.role);
    if (next.status) params.set('status', next.status);
    const qs = params.toString();
    startTransition(() => router.push(`/admin/users${qs ? `?${qs}` : ''}`));
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Tìm kiếm tên, email..."
        defaultValue={q}
        className="max-w-xs"
        onChange={(e) => {
          const val = e.target.value;
          clearTimeout((window as unknown as { __st?: ReturnType<typeof setTimeout> }).__st);
          (window as unknown as { __st?: ReturnType<typeof setTimeout> }).__st = setTimeout(
            () => navigate({ q: val }),
            400
          );
        }}
      />
      <select
        className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-card h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
        value={role}
        onChange={(e) => navigate({ role: e.target.value })}
      >
        <option value="">Tất cả vai trò</option>
        <option value="ADMIN">Admin</option>
        <option value="TEACHER">Giáo viên</option>
        <option value="TA">Trợ giảng (TA)</option>
        <option value="STUDENT">Học sinh</option>
      </select>
      <select
        className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-card h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
        value={status}
        onChange={(e) => navigate({ status: e.target.value })}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Hoạt động</option>
        <option value="INACTIVE">Không hoạt động</option>
        <option value="SUSPENDED">Tạm khóa</option>
        <option value="PENDING">Chờ xác thực</option>
      </select>
    </div>
  );
}
