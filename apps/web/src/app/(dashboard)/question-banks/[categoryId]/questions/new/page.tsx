import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { QuestionForm } from '@/components/features/quiz/QuestionForm';
import { buttonVariants } from '@/components/ui/button';
import type { CategoryQuestionBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Thêm câu hỏi vào kho' };
export const dynamic = 'force-dynamic';

export default async function NewBankQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { categoryId } = await params;
  const { folder } = await searchParams;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Gọi luôn kho để vừa kiểm quyền vừa lấy tên danh mục hiển thị. API trả 403
  // nếu người dùng không được soạn kho này.
  const api = apiServerClient(await cookies());
  const data = await api
    .get<CategoryQuestionBankData>(`/questions/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data) notFound();

  const backHref = `/question-banks/${categoryId}`;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Thêm câu hỏi vào kho</h1>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{data.categoryPath}</p>
        </div>
      </div>

      <QuestionForm bankCategoryId={categoryId} returnTo={backHref} defaultCategoryId={folder} />
    </div>
  );
}
