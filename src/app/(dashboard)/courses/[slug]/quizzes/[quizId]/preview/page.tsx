import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { getCourseBySlugAction } from '@/actions/courses';
import { getQuizPreviewAction } from '@/actions/quizzes';
import { QuizPreview } from '@/components/features/quiz/QuizPreview';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Brain } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Xem thử Quiz' };

export default async function QuizPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;

  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}/quizzes/${quizId}`);

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const quiz = await getQuizPreviewAction(quizId);
  if (!quiz) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-violet-500 shrink-0" />
          <Link
            href={`/courses/${slug}/quizzes/${quizId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
          >
            {quiz.title}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Xem thử</span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">Xem thử bài quiz</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Trải nghiệm quiz như học sinh, không lưu kết quả.</p>
      </div>

      <QuizPreview quiz={quiz} courseSlug={slug} />
    </div>
  );
}
