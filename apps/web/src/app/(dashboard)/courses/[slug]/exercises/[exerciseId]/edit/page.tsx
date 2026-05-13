import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { getExerciseAction } from '@/actions/exercises';
import { getCodeExerciseRubricAction } from '@/actions/rubric';
import { ExerciseSetup } from '@/components/features/code/ExerciseSetup';
import { RubricBuilder } from '@/components/features/assignments/RubricBuilder';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Code2 } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chỉnh sửa bài tập code' };

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  if (!hasMinRole(role, 'TEACHER')) redirect(`/courses/${slug}`);

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}`);

  const exercise = await getExerciseAction(exerciseId);
  if (!exercise || exercise.courseId !== course.id) notFound();

  const rubric = await getCodeExerciseRubricAction(exercise.id);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/courses/${slug}/exercises/${exerciseId}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Xem bài tập
        </Link>
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold">Chỉnh sửa bài tập code</h1>
            <p className="text-muted-foreground text-xs">{course.name}</p>
          </div>
        </div>
      </div>

      <ExerciseSetup
        exercise={{
          id: exercise.id,
          title: exercise.title,
          description: exercise.description,
          language: exercise.language,
          status: exercise.status,
          starterCode: exercise.starterCode,
          solutionCode: exercise.solutionCode,
          starterHtml: (exercise as any).starterHtml ?? null,
          starterCss: (exercise as any).starterCss ?? null,
          starterJs: (exercise as any).starterJs ?? null,
          timeLimit: exercise.timeLimit,
          memoryLimit: exercise.memoryLimit,
          testCases: exercise.testCases.map((tc) => ({
            id: tc.id,
            label: tc.label,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            points: tc.points,
            position: tc.position,
          })),
        }}
        courseSlug={slug}
      />

      <div className="border-border mt-10 border-t pt-8">
        <RubricBuilder
          ownerKind="codeExercise"
          ownerId={exercise.id}
          maxScore={10}
          initialRubric={rubric}
        />
      </div>
    </div>
  );
}
