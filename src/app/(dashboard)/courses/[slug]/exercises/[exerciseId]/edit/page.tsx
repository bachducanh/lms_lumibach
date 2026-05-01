import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getExerciseAction } from '@/actions/exercises';
import { ExerciseSetup } from '@/components/features/code/ExerciseSetup';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Code2 } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Chỉnh sửa bài tập code' };

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole;

  console.log('[DEBUG EditExercisePage] role:', role, 'user:', session?.user?.id);

  if (!hasMinRole(role, 'TEACHER')) {
    console.log('[DEBUG EditExercisePage] Redirecting because not TEACHER');
    redirect(`/courses/${slug}`);
  }

  const course = await getCourseBySlugAction(slug);
  console.log('[DEBUG EditExercisePage] course:', course ? course.id : 'null');
  if (!course) {
    console.log('[DEBUG EditExercisePage] notFound because !course');
    notFound();
  }

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  
  console.log('[DEBUG EditExercisePage] canManage:', canManage, 'ownerId:', course.ownerId);
  if (!canManage) {
    console.log('[DEBUG EditExercisePage] Redirecting because !canManage');
    redirect(`/courses/${slug}`);
  }

  const exercise = await getExerciseAction(exerciseId);
  console.log('[DEBUG EditExercisePage] exercise:', exercise ? exercise.id : 'null', 'courseId:', exercise?.courseId);
  if (!exercise || exercise.courseId !== course.id) {
    console.log('[DEBUG EditExercisePage] notFound because !exercise or wrong courseId. exercise:', !!exercise, 'courseId match:', exercise?.courseId === course?.id);
    notFound();
  }


  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/courses/${slug}/exercises/${exerciseId}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Xem bài tập
        </Link>
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold">Chỉnh sửa bài tập code</h1>
            <p className="text-xs text-muted-foreground">{course.name}</p>
          </div>
        </div>
      </div>

      <ExerciseSetup
        exercise={{
          id:           exercise.id,
          title:        exercise.title,
          description:  exercise.description,
          language:     exercise.language,
          status:       exercise.status,
          starterCode:  exercise.starterCode,
          solutionCode: exercise.solutionCode,
          starterHtml:  (exercise as any).starterHtml ?? null,
          starterCss:   (exercise as any).starterCss  ?? null,
          starterJs:    (exercise as any).starterJs   ?? null,
          timeLimit:    exercise.timeLimit,
          memoryLimit:  exercise.memoryLimit,
          testCases:    exercise.testCases.map((tc) => ({
            id:             tc.id,
            label:          tc.label,
            input:          tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden:       tc.isHidden,
            points:         tc.points,
            position:       tc.position,
          })),
        }}
        courseSlug={slug}
      />
    </div>
  );
}
