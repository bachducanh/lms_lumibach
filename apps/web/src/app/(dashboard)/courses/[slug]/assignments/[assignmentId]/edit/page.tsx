import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, AssignmentDetail, RubricData, ModuleWithItems } from '@lumibach/types';
import { AssignmentForm } from '@/components/features/assignments/AssignmentForm';
import { RubricBuilder } from '@/components/features/assignments/RubricBuilder';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chỉnh sửa bài tập' };

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ slug: string; assignmentId: string }>;
}) {
  const { slug, assignmentId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/assignments`);

  const assignment = await api
    .get<AssignmentDetail>(`/assignments/${assignmentId}`)
    .catch(() => null);
  if (!assignment || assignment.courseId !== course.id) notFound();

  const [modules, rubric] = await Promise.all([
    api.get<ModuleWithItems[]>('/modules', { query: { courseId: course.id } }),
    api.get<RubricData>(`/rubrics/assignment/${assignment.id}`).catch(() => null),
  ]);

  return (
    <div className="max-w-5xl">
      <AssignmentForm
        mode="edit"
        courseSlug={slug}
        courseId={course.id}
        modules={modules}
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
