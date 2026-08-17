import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { CategoryContentBankManager } from '@/components/features/courses/CategoryContentBankManager';
import type { CategoryContentBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Kho nội dung của danh mục' };
export const dynamic = 'force-dynamic';

export default async function CategoryContentBankPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const data = await api
    .get<CategoryContentBankData>(`/modules/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/question-banks"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Ngân hàng chung
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground/70 font-mono text-[11px] tracking-[0.18em] uppercase">
            Kho nội dung
          </p>
          <h1 className="mt-1 truncate text-3xl font-bold tracking-tight">{data.categoryName}</h1>
        </div>
        <Link
          href={`/question-banks/${categoryId}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <HelpCircle className="mr-1.5 h-4 w-4" />
          Kho câu hỏi
        </Link>
      </div>

      <CategoryContentBankManager data={data} />
    </div>
  );
}
