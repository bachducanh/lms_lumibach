import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadBankOrNull } from '@/lib/bank-guard';
import { hasMinRole } from '@/lib/permissions';
import { QuizForm } from '@/components/features/quiz/QuizForm';
import { buttonVariants } from '@/components/ui/button';
import { bankContentHref } from '@/lib/activity-owner';
import type { QuizDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, ListChecks } from 'lucide-react';

export const metadata = { title: 'Sửa quiz trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankQuizPage({
  params,
}: {
  params: Promise<{ categoryId: string; quizId: string }>;
}) {
  const { categoryId, quizId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Hai chốt khác nhau, cần cả hai: loadBankOrNull chứng minh người này soạn
  // được kho của danh mục; so khớp bankCategoryId chứng minh bản ghi nằm đúng
  // trong kho đó chứ không phải của danh mục khác.
  const loaded = await loadBankOrNull(categoryId);
  if (!loaded) notFound();
  const { api } = loaded;

  const quiz = await api.get<QuizDetail>(`/quizzes/${quizId}`).catch(() => null);
  // Chốt bản ghi thuộc ĐÚNG danh mục trên URL: nếu không, đường dẫn của một
  // danh mục mình soạn được sẽ mở ra quiz của danh mục khác.
  if (!quiz || quiz.bankCategoryId !== categoryId) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={bankContentHref(categoryId)}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{quiz.title}</h1>
            <p className="text-muted-foreground text-xs">Bản mẫu trong kho nội dung</p>
          </div>
        </div>
        <Link
          href={`${bankContentHref(categoryId)}/quizzes/${quizId}/manage`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ListChecks className="mr-1.5 h-4 w-4" />
          Câu hỏi ({quiz.questions.length})
        </Link>
      </div>

      <QuizForm
        owner={{ kind: 'bank', categoryId }}
        quiz={{
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          status: quiz.status as never,
          timeLimit: quiz.timeLimit,
          maxAttempts: quiz.maxAttempts,
          passingScore: quiz.passingScore,
          shuffleQuestions: quiz.shuffleQuestions,
          shuffleAnswers: quiz.shuffleAnswers,
          showResults: quiz.showResults,
          availableFrom: quiz.availableFrom,
          dueDate: quiz.dueDate,
          sebEnabled: quiz.sebEnabled ?? false,
          sebConfigUrl: quiz.sebConfigUrl ?? null,
          sebConfigName: quiz.sebConfigName ?? null,
        }}
      />
    </div>
  );
}
