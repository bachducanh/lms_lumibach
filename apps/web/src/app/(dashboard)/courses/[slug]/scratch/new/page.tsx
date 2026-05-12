import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { hasMinRole } from '@/lib/permissions';
import { ScratchExerciseForm } from '@/components/features/scratch/ScratchExerciseForm';
import { Cat } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Tạo bài Scratch' };

export default async function NewScratchExercisePage({
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
  if (!role || !hasMinRole(role, 'TEACHER')) redirect(`/courses/${slug}`);

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();
  if (role === 'TEACHER' && course.ownerId !== session!.user!.id) redirect(`/courses/${slug}`);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
          <Cat className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Tạo bài Scratch</h1>
          <p className="text-muted-foreground text-sm">
            Học sinh sẽ kéo thả block ngay trong LMS, giáo viên xem và chấm tay
          </p>
        </div>
      </div>

      <ScratchExerciseForm
        mode="create"
        courseId={course.id}
        courseSlug={slug}
        moduleId={moduleId ?? null}
      />
    </div>
  );
}
