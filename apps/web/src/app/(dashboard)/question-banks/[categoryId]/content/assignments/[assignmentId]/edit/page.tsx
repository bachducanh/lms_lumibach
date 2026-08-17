import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadBankOrNull } from '@/lib/bank-guard';
import { hasMinRole } from '@/lib/permissions';
import { AssignmentForm } from '@/components/features/assignments/AssignmentForm';
import { RubricBuilder } from '@/components/features/assignments/RubricBuilder';
import type { AssignmentDetail, RubricData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Sửa bài tập trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankAssignmentPage({
  params,
}: {
  params: Promise<{ categoryId: string; assignmentId: string }>;
}) {
  const { categoryId, assignmentId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Hai chốt khác nhau, cần cả hai: `loadBankOrNull` chứng minh người này soạn
  // được kho của danh mục; so khớp `bankCategoryId` chứng minh bài tập nằm đúng
  // trong kho đó chứ không phải của danh mục khác.
  const loaded = await loadBankOrNull(categoryId);
  if (!loaded) notFound();
  const { api } = loaded;

  const assignment = await api
    .get<AssignmentDetail>(`/assignments/${assignmentId}`)
    .catch(() => null);
  if (!assignment || assignment.bankCategoryId !== categoryId) notFound();

  const rubric = await api.get<RubricData>(`/rubrics/assignment/${assignmentId}`).catch(() => null);

  return (
    <div className="max-w-5xl">
      <AssignmentForm
        mode="edit"
        owner={{ kind: 'bank', categoryId }}
        modules={[]}
        assignment={{
          id: assignment.id,
          title: assignment.title,
          instructions: assignment.instructions,
          type: assignment.type,
          status: assignment.status,
          maxScore: assignment.maxScore,
          weight: assignment.weight,
          availableFrom: assignment.availableFrom,
          dueDate: assignment.dueDate,
          lateDeadline: assignment.lateDeadline,
          latePolicy: assignment.latePolicy,
          latePenalty: assignment.latePenalty,
          allowResubmit: assignment.allowResubmit,
          maxAttempts: assignment.maxAttempts,
          maxFileSizeMb: assignment.maxFileSizeMb,
          maxFiles: assignment.maxFiles,
        }}
      />

      <div className="border-border mt-10 border-t pt-8">
        <RubricBuilder
          ownerKind="assignment"
          ownerId={assignment.id}
          maxScore={assignment.maxScore}
          initialRubric={rubric}
        />
      </div>
    </div>
  );
}
