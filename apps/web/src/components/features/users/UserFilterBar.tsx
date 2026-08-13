'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';

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
      <SimpleSelect
        size="sm"
        aria-label="Lọc theo vai trò"
        value={role}
        onValueChange={(v) => navigate({ role: v })}
        options={[
          { value: '', label: 'Tất cả vai trò' },
          { value: 'ADMIN', label: 'Quản trị viên' },
          { value: 'TEACHER', label: 'Giáo viên' },
          { value: 'TA', label: 'Trợ giảng (TA)' },
          { value: 'STUDENT', label: 'Học sinh' },
        ]}
      />
      <SimpleSelect
        size="sm"
        aria-label="Lọc theo trạng thái"
        value={status}
        onValueChange={(v) => navigate({ status: v })}
        options={[
          { value: '', label: 'Tất cả trạng thái' },
          { value: 'ACTIVE', label: 'Hoạt động' },
          { value: 'INACTIVE', label: 'Không hoạt động' },
          { value: 'SUSPENDED', label: 'Tạm khoá' },
          { value: 'PENDING', label: 'Chờ xác thực' },
        ]}
      />
    </div>
  );
}
