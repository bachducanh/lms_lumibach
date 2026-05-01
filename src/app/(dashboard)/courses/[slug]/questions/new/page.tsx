import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { QuestionForm } from '@/components/features/quiz/QuestionForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Tạo câu hỏi' };

export default async function NewQuestionPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ quizId?: string; categoryId?: string }>;
}) {
  const { slug }               = await params;
  const { quizId, categoryId } = await searchParams;
  const session    = await auth();
  const role       = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/questions`);

  const backHref = quizId
    ? `/courses/${slug}/quizzes/${quizId}/manage`
    : `/courses/${slug}/questions`;

  const returnTo = quizId
    ? `/courses/${slug}/quizzes/${quizId}/manage`
    : undefined;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Tạo câu hỏi mới</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{course.name}</p>
        </div>
      </div>

      <QuestionForm courseId={course.id} courseSlug={slug} returnTo={returnTo} defaultCategoryId={categoryId} />
    </div>
  );
}
