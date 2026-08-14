import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { QuestionForm } from '@/components/features/quiz/QuestionForm';
import { buttonVariants } from '@/components/ui/button';
import type { CategoryQuestionBankData, QuestionItem } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Sửa câu hỏi trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankQuestionPage({
  params,
}: {
  params: Promise<{ categoryId: string; questionId: string }>;
}) {
  const { categoryId, questionId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const [data, question] = await Promise.all([
    api.get<CategoryQuestionBankData>(`/questions/bank-categories/${categoryId}`).catch(() => null),
    api.get<QuestionItem>(`/questions/${questionId}`).catch(() => null),
  ]);
  if (!data || !question) notFound();

  const backHref = `/question-banks/${categoryId}`;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Sửa câu hỏi trong kho</h1>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{data.categoryPath}</p>
        </div>
      </div>

      {/* Quyền sửa do API quyết định (chỉ người tạo hoặc ADMIN): nếu không đủ
          quyền thì lệnh lưu trả 403 kèm lời giải thích, không cần đoán trước. */}
      <QuestionForm question={question} returnTo={backHref} />
    </div>
  );
}
