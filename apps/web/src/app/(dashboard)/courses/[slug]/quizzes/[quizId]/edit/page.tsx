import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, QuizDetail } from '@lumibach/types';
import { QuizForm } from '@/components/features/quiz/QuizForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Sửa quiz' };

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = course.viewerCanManage;
  if (!canManage) redirect(`/courses/${slug}/quizzes`);

  const quiz = await api.get<QuizDetail>(`/quizzes/${quizId}`).catch(() => null);
  if (!quiz) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Sửa quiz</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{quiz.title}</p>
        </div>
      </div>

      <QuizForm courseId={course.id} courseSlug={slug} quiz={quiz} />
    </div>
  );
}
