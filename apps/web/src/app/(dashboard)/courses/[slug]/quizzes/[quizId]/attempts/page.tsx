import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getQuizAction } from '@/actions/quizzes';
import { listAllAttemptsDetailedAction } from '@/actions/attempts';
import { hasMinRole } from '@/lib/permissions';
import { AttemptsTable } from '@/components/features/quiz/AttemptsTable';
import { Brain } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Bài làm' };

export default async function AttemptsPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}/quizzes/${quizId}`);

  const quiz = await getQuizAction(quizId);
  if (!quiz) notFound();

  const { attempts, questions } = await listAllAttemptsDetailedAction(quizId);

  const submitted = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  const graded = attempts.filter((a) => a.status === 'GRADED');
  const avgScore =
    graded.length > 0 ? graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length : null;
  const maxScore = attempts.find((a) => a.maxScore != null)?.maxScore ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Brain className="h-4 w-4 shrink-0 text-violet-500" />
        <Link href={`/courses/${slug}/quizzes`} className="hover:text-foreground transition-colors">
          Quiz
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className="hover:text-foreground max-w-40 truncate transition-colors"
        >
          {quiz.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium">Bài làm</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
            <span>{attempts.length} lượt làm</span>
            <span>·</span>
            <span>{submitted.length} đã nộp</span>
            {avgScore != null && maxScore != null && (
              <>
                <span>·</span>
                <span>
                  Điểm TB:{' '}
                  <span className="text-foreground font-semibold">
                    {avgScore.toFixed(2)}/{maxScore}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <AttemptsTable
        attempts={attempts}
        questions={questions}
        quizId={quizId}
        quizTitle={quiz.title}
        courseSlug={slug}
      />
    </div>
  );
}
