import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, QuestionItem } from '@lumibach/types';
import { QuestionForm } from '@/components/features/quiz/QuestionForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Sửa câu hỏi' };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ slug: string; questionId: string }>;
}) {
  const { slug, questionId } = await params;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = course.viewerCanManage;
  if (!canManage) redirect(`/courses/${slug}/questions`);

  const question = await api.get<QuestionItem>(`/questions/${questionId}`).catch(() => null);
  if (!question) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/courses/${slug}/questions`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Sửa câu hỏi</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{course.name}</p>
        </div>
      </div>

      <QuestionForm courseId={course.id} courseSlug={slug} question={question} />
    </div>
  );
}
