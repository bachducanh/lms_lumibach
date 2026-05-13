import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { getQuizAction, listQuizBanksAction } from '@/actions/quizzes';
import { QuizBuilder } from '@/components/features/quiz/QuizBuilder';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Brain } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Quản lý câu hỏi' };

export default async function ManageQuizPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  if (!canManage) redirect(`/courses/${slug}/quizzes/${quizId}`);

  const quiz = await getQuizAction(quizId);
  if (!quiz) notFound();

  const quizQuestionIds = new Set(quiz.questions.map((qq) => qq.questionId));
  const banks = await listQuizBanksAction(course.id);
  const filteredBanks = banks.map((b) => ({
    ...b,
    questions: b.questions.filter((q) => !quizQuestionIds.has(q.id)),
  }));

  const initialItems = quiz.questions.map((qq) => ({
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Brain className="h-4 w-4 shrink-0 text-violet-500" />
          <Link
            href={`/courses/${slug}/quizzes/${quizId}`}
            className="text-muted-foreground hover:text-foreground truncate text-sm transition-colors"
          >
            {quiz.title}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Quản lý câu hỏi</span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">Quản lý câu hỏi</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{quiz.title}</p>
      </div>

      <QuizBuilder
        quizId={quizId}
        courseSlug={slug}
        initialItems={initialItems}
        banks={filteredBanks}
      />
    </div>
  );
}
