import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getQuestionAction } from '@/actions/questions';
import { QuestionForm } from '@/components/features/quiz/QuestionForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Sửa câu hỏi' };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ slug: string; questionId: string }>;
}) {
  const { slug, questionId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/questions`);

  const question = await getQuestionAction(questionId);
  if (!question) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/courses/${slug}/questions`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Sửa câu hỏi</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{course.name}</p>
        </div>
      </div>

      <QuestionForm courseId={course.id} courseSlug={slug} question={question} />
    </div>
  );
}
