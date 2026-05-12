'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { softDeleteUserAction, resetUserPasswordAction } from '@/actions/users';
import { toast } from 'sonner';
import type { UserRole, UserStatus } from '@lumibach/db';

type User = {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  TA: 'Trợ giảng',
  STUDENT: 'Học sinh',
};

const STATUS_VARIANTS: Record<UserStatus, 'success' | 'danger' | 'suspended' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'danger',
  SUSPENDED: 'suspended',
  PENDING: 'warning',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Không hoạt động',
  SUSPENDED: 'Tạm khóa',
  PENDING: 'Chờ xác thực',
};

export function UserTable({ users }: { users: User[] }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<{ name: string; password: string } | null>(null);

  function handleDelete(userId: string) {
    startTransition(async () => {
      const result = await softDeleteUserAction(userId);
      if (result.success) {
        toast.success(result.message);
        setConfirmDelete(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleResetPassword(userId: string, name: string) {
    startTransition(async () => {
      const result = await resetUserPasswordAction(userId);
      if (result.success && result.data) {
        setNewPassword({ name, password: result.data.password });
      } else if (!result.success) {
        toast.error(result.error);
      }
    });
  }

  if (users.length === 0) {
    return (
      <div className="ring-foreground/10 text-muted-foreground rounded-xl py-16 text-center ring-1">
        Không có người dùng nào.
      </div>
    );
  }

  return (
    <>
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card ring-foreground/10 w-80 space-y-4 rounded-xl p-6 shadow-xl ring-1">
            <p className="font-medium">Xóa người dùng này?</p>
            <p className="text-muted-foreground text-sm">
              Tài khoản sẽ bị vô hiệu hóa và không thể đăng nhập.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => handleDelete(confirmDelete)}
              >
                {pending ? 'Đang xóa...' : 'Xóa'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {newPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card ring-foreground/10 w-80 space-y-4 rounded-xl p-6 shadow-xl ring-1">
            <p className="font-medium">
              Mật khẩu mới của <strong>{newPassword.name}</strong>
            </p>
            <code className="bg-muted block rounded px-3 py-2 font-mono text-base font-bold tracking-wider">
              {newPassword.password}
            </code>
            <p className="text-muted-foreground text-xs">Ghi lại và gửi cho người dùng ngay.</p>
            <Button className="w-full" onClick={() => setNewPassword(null)}>
              Đã ghi lại
            </Button>
          </div>
        </div>
      )}

      <div className="ring-foreground/10 overflow-x-auto rounded-xl ring-1">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Họ tên</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Vai trò</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {users.map((user) => {
              const displayName = user.fullName ?? `${user.firstName} ${user.lastName}`;
              return (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{displayName}</p>
                    {user.username && (
                      <p className="text-muted-foreground text-xs">@{user.username}</p>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[user.status]}>
                      {STATUS_LABELS[user.status]}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/users/${user.id}/edit`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        Sửa
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleResetPassword(user.id, displayName)}
                      >
                        Đổi MK
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() => setConfirmDelete(user.id)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
