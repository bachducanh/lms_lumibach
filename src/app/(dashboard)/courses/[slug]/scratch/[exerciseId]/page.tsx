import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCourseBySlugAction } from '@/actions/courses';
import { logActivity } from '@/lib/activity';
import { hasMinRole } from '@/lib/permissions';
import {
  listMyScratchSubmissionsAction,
  listScratchSubmissionsAction,
} from '@/actions/scratch';
import { ScratchTakePanel } from '@/components/features/scratch/ScratchTakePanel';
import { ScratchTeacherPanel } from '@/components/features/scratch/ScratchTeacherPanel';
import { buttonVariants } from '@/components/ui/button';
import { Cat, ChevronLeft, Pencil } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const ex = await prisma.codeExercise.findUnique({
    where: { id: exerciseId, deletedAt: null },
    select: { title: true },
  });
  return { title: ex?.title ?? 'Bài Scratch' };
}

export default async function ScratchExercisePage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  const userId  = session?.user?.id;
  if (!userId) redirect('/login');

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const exercise = await prisma.codeExercise.findUnique({
    where:  { id: exerciseId, deletedAt: null },
    select: {
      id: true, courseId: true, title: true, description: true,
      language: true, status: true, starterFileUrl: true,
    },
  });
  if (!exercise || exercise.courseId !== course.id) notFound();
  if (exercise.language !== 'SCRATCH') {
    redirect(`/courses/${slug}/exercises/${exerciseId}`);
  }

  const canEdit  = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const isTeacher = !!role && hasMinRole(role, 'TA');

  if (role === 'STUDENT' && exercise.status !== 'PUBLISHED') notFound();

  logActivity({
    userId, courseId: course.id, action: 'VIEW_EXERCISE',
    resourceType: 'exercise', resourceId: exerciseId, resourceName: exercise.title,
  });

  const [mySubs, allSubs] = await Promise.all([
    listMyScratchSubmissionsAction(exerciseId),
    isTeacher ? listScratchSubmissionsAction(exerciseId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="-mx-6 -mt-6 border-b border-border bg-card px-6 py-5">
        <Link
          href={`/courses/${slug}/modules`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-orange-400 transition-colors mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Nội dung khoá học
        </Link>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cat className="h-4 w-4 text-orange-400" />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
                Bài Scratch
              </p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{exercise.title}</h1>
          </div>
          {canEdit && (
            <Link
              href={`/courses/${slug}/scratch/${exerciseId}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              Chỉnh sửa
            </Link>
          )}
        </div>

        {exercise.description && (
          <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-3xl">
            {exercise.description}
          </p>
        )}
      </div>

      {/* Student panel — student takes the exercise; teacher also sees it for testing */}
      <ScratchTakePanel
        exerciseId={exerciseId}
        starterUrl={exercise.starterFileUrl}
        initialSubs={mySubs}
      />

      {/* Teacher review panel */}
      {isTeacher && (
        <ScratchTeacherPanel
          submissions={allSubs}
        />
      )}
    </div>
  );
}
