import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCourseBySlugAction } from '@/actions/courses';
import { hasMinRole } from '@/lib/permissions';
import { ScratchExerciseForm } from '@/components/features/scratch/ScratchExerciseForm';
import { Cat } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Sửa bài Scratch' };

export default async function EditScratchExercisePage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  const userId  = session?.user?.id;
  if (!userId || !role || !hasMinRole(role, 'TEACHER')) redirect(`/courses/${slug}`);

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();
  if (role === 'TEACHER' && course.ownerId !== userId) redirect(`/courses/${slug}`);

  const ex = await prisma.codeExercise.findUnique({
    where: { id: exerciseId, deletedAt: null },
    select: {
      id: true, courseId: true, title: true, description: true,
      starterFileUrl: true, status: true, language: true,
    },
  });
  if (!ex || ex.courseId !== course.id) notFound();
  if (ex.language !== 'SCRATCH') redirect(`/courses/${slug}/exercises/${exerciseId}/edit`);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
          <Cat className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Sửa bài Scratch</h1>
          <p className="text-sm text-muted-foreground">{ex.title}</p>
        </div>
      </div>

      <ScratchExerciseForm
        mode="edit"
        exerciseId={ex.id}
        courseSlug={slug}
        initial={{
          title:          ex.title,
          description:    ex.description,
          starterFileUrl: ex.starterFileUrl,
          status:         ex.status,
        }}
      />
    </div>
  );
}
