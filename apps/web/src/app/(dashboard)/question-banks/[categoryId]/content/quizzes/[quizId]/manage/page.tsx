import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadBankOrNull } from '@/lib/bank-guard';
import { hasMinRole } from '@/lib/permissions';
import { QuizBuilder } from '@/components/features/quiz/QuizBuilder';
import { buttonVariants } from '@/components/ui/button';
import { bankContentHref } from '@/lib/activity-owner';
import type { QuizBankGroup, QuizDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, Brain } from 'lucide-react';

export const metadata = { title: 'Câu hỏi của quiz trong kho' };
export const dynamic = 'force-dynamic';

export default async function ManageBankQuizPage({
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
  if (!quiz || quiz.bankCategoryId !== categoryId) notFound();

  // Nguồn câu hỏi là ngân hàng câu hỏi CỦA DANH MỤC này, không phải kho của một
  // lớp — quiz mẫu chỉ nhận câu hỏi cùng danh mục (API cũng chốt lại điều đó).
  const quizQuestionIds = new Set(quiz.questions.map((qq) => qq.questionId));
  const banks = await api.get<QuizBankGroup[]>('/quizzes/banks', {
    query: { bankCategoryId: categoryId },
  });
  const filteredBanks = banks.map((b) => ({
    ...b,
    questions: b.questions.filter((q) => !quizQuestionIds.has(q.id)),
  }));

  const initialItems = quiz.questions.map((qq) => ({
    id: qq.id,
    questionId: qq.questionId,
    position: qq.position,
    points: qq.points,
    question: {
      type: qq.question.type,
      content: qq.question.content,
      points: qq.question.points,
    },
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`${bankContentHref(categoryId)}/quizzes/${quizId}/edit`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Brain className="h-4 w-4 shrink-0 text-violet-500" />
          <span className="text-muted-foreground truncate text-sm">{quiz.title}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Quản lý câu hỏi</span>
        </div>
      </div>

      <QuizBuilder
        quizId={quizId}
        owner={{ kind: 'bank', categoryId }}
        initialItems={initialItems}
        banks={filteredBanks}
      />
    </div>
  );
}
