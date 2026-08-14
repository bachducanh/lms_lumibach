import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { CategoryBankManager } from '@/components/features/quiz/CategoryBankManager';
import type { CategoryQuestionBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, FolderKanban, Library } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Kho câu hỏi của danh mục' };
export const dynamic = 'force-dynamic';

export default async function CategoryBankPage({
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
    .get<CategoryQuestionBankData>(`/questions/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/question-banks"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Ngân hàng câu hỏi chung
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Library className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Kho câu hỏi</h1>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">{data.categoryPath}</p>
          </div>
        </div>
        <Link
          href={`/question-banks/${categoryId}/content`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FolderKanban className="mr-1.5 h-4 w-4" />
          Kho nội dung
        </Link>
      </div>

      <CategoryBankManager data={data} />
    </div>
  );
}
