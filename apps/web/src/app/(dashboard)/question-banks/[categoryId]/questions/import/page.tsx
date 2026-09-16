import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { WordImportWorkspace } from '@/components/features/quiz/WordImportWorkspace';
import { buttonVariants } from '@/components/ui/button';
import type { CategoryQuestionBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Nhập đề từ Word' };
export const dynamic = 'force-dynamic';

export default async function ImportBankQuestionsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Gọi kho để vừa kiểm quyền vừa lấy tên hiển thị; API trả 403 nếu không được
  // soạn kho này.
  const api = apiServerClient(await cookies());
  const data = await api
    .get<CategoryQuestionBankData>(`/questions/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data) notFound();

  const backHref = `/question-banks/${categoryId}`;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Nhập đề từ Word</h1>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{data.categoryPath}</p>
        </div>
      </div>

      <WordImportWorkspace
        bankCategoryId={categoryId}
        returnTo={backHref}
        tenNoiNhan={`kho của ${data.categoryName}`}
      />
    </div>
  );
}
