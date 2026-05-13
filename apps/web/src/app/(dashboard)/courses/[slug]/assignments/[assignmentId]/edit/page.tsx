import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { getAssignmentAction } from '@/actions/assignments';
import { AssignmentForm } from '@/components/features/assignments/AssignmentForm';
import { RubricBuilder } from '@/components/features/assignments/RubricBuilder';
import { getRubricAction } from '@/actions/rubric';
import { prisma } from '@/lib/db';
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

  const assignment = await getAssignmentAction(assignmentId);
  if (!assignment || assignment.courseId !== course.id) notFound();

  const [modules, rubric] = await Promise.all([
    prisma.module.findMany({
      where: { courseId: course.id },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    getRubricAction(assignment.id),
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
