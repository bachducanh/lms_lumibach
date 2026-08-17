import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadBankOrNull } from '@/lib/bank-guard';
import { hasMinRole } from '@/lib/permissions';
import { ExerciseSetup } from '@/components/features/code/ExerciseSetup';
import { RubricBuilder } from '@/components/features/assignments/RubricBuilder';
import { buttonVariants } from '@/components/ui/button';
import { bankContentHref } from '@/lib/activity-owner';
import type { CodeExerciseDetail, RubricData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, Code2 } from 'lucide-react';

export const metadata = { title: 'Sửa bài code trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankExercisePage({
  params,
}: {
  params: Promise<{ categoryId: string; exerciseId: string }>;
}) {
  const { categoryId, exerciseId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Hai chốt khác nhau, cần cả hai: loadBankOrNull chứng minh người này soạn
  // được kho của danh mục; so khớp bankCategoryId chứng minh bản ghi nằm đúng
  // trong kho đó chứ không phải của danh mục khác.
  const loaded = await loadBankOrNull(categoryId);
  if (!loaded) notFound();
  const { api } = loaded;

  const exercise = await api
    .get<CodeExerciseDetail>(`/code-exercises/${exerciseId}`)
    .catch(() => null);
  if (!exercise || exercise.bankCategoryId !== categoryId) notFound();

  const rubric = await api
    .get<RubricData>(`/rubrics/code-exercise/${exerciseId}`)
    .catch(() => null);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={bankContentHref(categoryId)}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-violet-400" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{exercise.title}</h1>
            <p className="text-muted-foreground text-xs">Bản mẫu trong kho nội dung</p>
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
          starterHtml: exercise.starterHtml ?? null,
          starterCss: exercise.starterCss ?? null,
          starterJs: exercise.starterJs ?? null,
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
        owner={{ kind: 'bank', categoryId }}
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
