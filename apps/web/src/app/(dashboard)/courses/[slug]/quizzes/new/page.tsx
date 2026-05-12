import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { QuizForm } from '@/components/features/quiz/QuizForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Tạo quiz' };

export default async function NewQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}) {
  const { slug } = await params;
  const { moduleId } = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/quizzes`);

  const backHref = moduleId ? `/courses/${slug}/modules` : `/courses/${slug}/quizzes`;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Tạo quiz mới</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{course.name}</p>
        </div>
      </div>

      <QuizForm courseId={course.id} courseSlug={slug} moduleId={moduleId} />
    </div>
  );
}
