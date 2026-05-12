import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER: 'Cập nhật tài khoản',
  DELETE_USER: 'Xóa tài khoản',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  IMPORT_USERS: 'Import người dùng',
  REGISTER: 'Đăng ký',
  VERIFY_EMAIL: 'Xác thực email',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { fullName: true, firstName: true, email: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nhật ký hoạt động</h1>
        <p className="text-muted-foreground text-sm">Tổng {total} mục</p>
      </div>

      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="text-muted-foreground py-12 text-center">Chưa có nhật ký nào.</p>
        )}
        {logs.map((log) => (
          <Card key={log.id} size="sm">
            <CardContent className="flex items-start gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  {log.resource && (
                    <span className="text-muted-foreground text-xs">
                      {log.resource}
                      {log.resourceId ? ` #${log.resourceId.slice(-6)}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {log.user ? (log.user.fullName ?? log.user.firstName) : 'Hệ thống'}
                  {log.userRole ? ` · ${log.userRole}` : ''}
                </p>
              </div>
              <p className="text-muted-foreground text-xs whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('vi-VN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/audit-logs?page=${page - 1}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Trước
            </Link>
          )}
          <span className="text-muted-foreground text-sm">
            Trang {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/audit-logs?page=${page + 1}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sau
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
