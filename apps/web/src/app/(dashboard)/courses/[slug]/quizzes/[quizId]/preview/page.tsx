import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, QuizPreview as QuizPreviewData } from '@lumibach/types';
import { QuizPreview } from '@/components/features/quiz/QuizPreview';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Brain } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Xem thử Quiz' };

export default async function QuizPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}/quizzes/${quizId}`);

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const quiz = await api.get<QuizPreviewData>(`/quizzes/${quizId}/preview`).catch(() => null);
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
        <div className="flex min-w-0 items-center gap-2">
          <Brain className="h-4 w-4 shrink-0 text-violet-500" />
          <Link
            href={`/courses/${slug}/quizzes/${quizId}`}
            className="text-muted-foreground hover:text-foreground truncate text-sm transition-colors"
          >
            {quiz.title}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Xem thử</span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">Xem thử bài quiz</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Trải nghiệm quiz như học sinh, không lưu kết quả.
        </p>
      </div>

      <QuizPreview quiz={quiz} courseSlug={slug} />
    </div>
  );
}
