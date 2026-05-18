import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { UserFilterBar } from '@/components/features/users/UserFilterBar';
import { UserTable } from '@/components/features/users/UserTable';
import type { UserRole, UserStatus } from '@lumibach/db';

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const role = typeof sp.role === 'string' ? sp.role : '';
  const status = typeof sp.status === 'string' ? sp.status : '';
  const page = typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { username: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(role ? { role: role as UserRole } : {}),
    ...(status ? { status: status as UserStatus } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/admin/users${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="lb-stagger space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        style={{ ['--i' as string]: 0 }}
      >
        <div>
          <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-muted-foreground text-sm">Tổng: {total} tài khoản</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/admin/users/import" className={buttonVariants({ variant: 'outline' })}>
            Import Excel
          </Link>
          <Link href="/admin/users/new" className={buttonVariants({})}>
            Tạo tài khoản
          </Link>
        </div>
      </div>

      <div style={{ ['--i' as string]: 1 }}>
        <UserFilterBar q={q} role={role} status={status} />
      </div>

      <div style={{ ['--i' as string]: 2 }}>
        <UserTable users={users} />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildPageHref(page - 1)}
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
              href={buildPageHref(page + 1)}
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
