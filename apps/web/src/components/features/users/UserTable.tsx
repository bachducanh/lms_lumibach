'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localUsers, setLocalUsers] = useState(users);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<{ name: string; password: string } | null>(null);
  // Người đang được đổi mật khẩu; mở hộp thoại cho nhập tay hoặc chọn ngẫu nhiên.
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  function handleDelete(userId: string) {
    startTransition(async () => {
      try {
        await apiClient.delete(`/users/${userId}`);
        setLocalUsers((current) => current.filter((user) => user.id !== userId));
        toast.success('Đã xóa người dùng.');
        setConfirmDelete(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xóa người dùng');
      }
    });
  }

  function handleVerify(userId: string, name: string) {
    startTransition(async () => {
      try {
        const res = await apiClient.post<{ message: string }>(`/users/${userId}/verify-email`, {});
        // Cập nhật ngay tại chỗ để nút biến mất và trạng thái đổi, không phải
        // chờ router.refresh() đi vòng qua máy chủ.
        setLocalUsers((current) =>
          current.map((u) => (u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus } : u))
        );
        toast.success(`${name}: ${res.message}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xác thực tài khoản');
      }
    });
  }

  /** `password` bỏ trống = để hệ thống sinh ngẫu nhiên. */
  function handleResetPassword(userId: string, name: string, password?: string) {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ password: string }>(
          `/users/${userId}/reset-password`,
          password ? { password } : {}
        );
        setResetTarget(null);
        setNewPassword({ name, password: data.password });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi đặt lại mật khẩu');
      }
    });
  }

  if (localUsers.length === 0) {
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
              Tài khoản sẽ bị xoá vĩnh viễn khỏi cơ sở dữ liệu.
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

      {resetTarget && (
        <ResetPasswordDialog
          name={resetTarget.name}
          pending={pending}
          onCancel={() => setResetTarget(null)}
          onSubmit={(pwd) => handleResetPassword(resetTarget.id, resetTarget.name, pwd)}
        />
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
            {localUsers.map((user) => {
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
                      {/* Chỉ hiện với tài khoản đang chờ — lối thoát khi email
                          xác thực không tới nơi (hộp thư rác, Gmail chặn,
                          máy chủ mất đường ra Internet). */}
                      {user.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-600"
                          disabled={pending}
                          onClick={() => handleVerify(user.id, displayName)}
                        >
                          Xác thực
                        </Button>
                      )}
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
                        onClick={() => setResetTarget({ id: user.id, name: displayName })}
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

/**
 * Hộp thoại đổi mật khẩu cho một tài khoản.
 *
 * Hai lối dùng: tự gõ mật khẩu (đọc cho học sinh ngay tại lớp) hoặc để hệ thống
 * sinh ngẫu nhiên như trước. Ô nhập để `type="text"` có nút ẩn/hiện — quản trị
 * viên cần đọc lại đúng chuỗi mình vừa đặt, che đi thì dễ gõ sai.
 */
function ResetPasswordDialog({
  name,
  pending,
  onCancel,
  onSubmit,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (password?: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(true);

  const tooShort = password.length > 0 && password.length < 8;

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return;
    onSubmit(password);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submitManual}
        className="bg-card ring-foreground/10 w-full max-w-sm space-y-4 rounded-xl p-6 shadow-xl ring-1"
      >
        <div>
          <p className="font-medium">Đổi mật khẩu</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Tài khoản <strong>{name}</strong>
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-password" className="text-sm font-medium">
            Mật khẩu mới
          </label>
          <div className="flex gap-2">
            <input
              id="new-password"
              autoFocus
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
              className="border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-3 font-mono text-sm focus:ring-1 focus:outline-none"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVisible((v) => !v)}
              className="shrink-0"
            >
              {visible ? 'Ẩn' : 'Hiện'}
            </Button>
          </div>
          {tooShort && <p className="text-destructive text-xs">Mật khẩu tối thiểu 8 ký tự.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending || password.length < 8}>
            {pending ? 'Đang lưu...' : 'Đặt mật khẩu này'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onSubmit(undefined)}
          >
            Tạo mật khẩu ngẫu nhiên
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Huỷ
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Người dùng sẽ đăng nhập bằng mật khẩu này ngay lập tức. Phiên đang đăng nhập của họ không
          bị đóng.
        </p>
      </form>
    </div>
  );
}
