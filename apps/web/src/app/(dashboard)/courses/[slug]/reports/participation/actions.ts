'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import type { ActivityAction, ModuleItemType, UserRole } from '@lumibach/db';

type ResourceOption = {
  key: string;
  type: ModuleItemType;
  title: string;
  resourceId: string;
  href: string;
};

const VIEW_ACTIONS_BY_TYPE: Partial<Record<ModuleItemType, ActivityAction[]>> = {
  LESSON: ['VIEW_LESSON'],
  ASSIGNMENT: ['VIEW_ASSIGNMENT'],
  QUIZ: ['START_QUIZ'],
  CODE_EXERCISE: ['VIEW_EXERCISE'],
};

export async function sendParticipationReminderAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const resourceKey = String(formData.get('resource') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!slug || !resourceKey) redirect(`/courses/${slug}/reports/participation`);

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;
  if (!role || !userId) redirect('/login');

  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      ownerId: true,
      coTeachers: { where: { userId }, select: { id: true } },
      teachingAssistants: { where: { userId }, select: { id: true } },
    },
  });
  if (!course) redirect('/courses');

  const canSend =
    role === 'ADMIN' ||
    course.ownerId === userId ||
    course.coTeachers.length > 0 ||
    course.teachingAssistants.length > 0;
  if (!canSend) {
    redirect(
      `/courses/${slug}/reports/participation?${new URLSearchParams({
        resource: resourceKey,
        status,
        error: 'forbidden',
      }).toString()}`
    );
  }

  const resource = await resolveResource(course.id, slug, resourceKey);
  if (!resource) redirect(`/courses/${slug}/reports/participation`);

  const [students, viewedUserIds, interactedUserIds] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: course.id, status: 'ACTIVE', user: { role: 'STUDENT' } },
      select: {
        userId: true,
        user: { select: { fullName: true, firstName: true, email: true } },
      },
    }),
    getViewedUserIds(course.id, resource),
    getInteractedUserIds(resource),
  ]);

  const completed = new Set([...viewedUserIds, ...interactedUserIds]);
  const targets = students.filter((student) => !completed.has(student.userId));

  await Promise.all(
    targets.map((student) =>
      createNotification({
        userId: student.userId,
        type: 'ANNOUNCEMENT',
        title: `Nhắc học: ${resource.title}`,
        body: `Bạn chưa xem hoặc hoàn thành "${resource.title}" trong khóa ${course.name}.`,
        link: resource.href,
      })
    )
  );

  revalidatePath(`/courses/${slug}/reports/participation`);
  redirect(
    `/courses/${slug}/reports/participation?${new URLSearchParams({
      resource: resourceKey,
      status,
      reminded: String(targets.length),
    }).toString()}`
  );
}

async function resolveResource(
  courseId: string,
  slug: string,
  resourceKey: string
): Promise<ResourceOption | null> {
  const [type, resourceId] = resourceKey.split(':') as [ModuleItemType | undefined, string?];
  if (!type || !resourceId) return null;

  const item = await prisma.moduleItem.findFirst({
    where: {
      module: { courseId },
      type,
      OR: [
        { lessonId: resourceId },
        { assignmentId: resourceId },
        { quizId: resourceId },
        { codeExerciseId: resourceId },
      ],
    },
    select: {
      title: true,
      type: true,
      lessonId: true,
      assignmentId: true,
      quizId: true,
      codeExerciseId: true,
    },
  });
  if (!item) return null;

  const actualResourceId =
    item.lessonId ?? item.assignmentId ?? item.quizId ?? item.codeExerciseId ?? null;
  if (!actualResourceId) return null;

  return {
    key: `${item.type}:${actualResourceId}`,
    type: item.type,
    title: item.title,
    resourceId: actualResourceId,
    href: resourceHref(slug, item.type, actualResourceId),
  };
}

async function getViewedUserIds(courseId: string, resource: ResourceOption) {
  const actions = VIEW_ACTIONS_BY_TYPE[resource.type];
  if (!actions) return new Set<string>();
  const logs = await prisma.activityLog.findMany({
    where: {
      courseId,
      resourceId: resource.resourceId,
      action: { in: actions },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(logs.map((log) => log.userId));
}

async function getInteractedUserIds(resource: ResourceOption) {
  if (resource.type === 'ASSIGNMENT') {
    const rows = await prisma.submission.findMany({
      where: { assignmentId: resource.resourceId, submittedAt: { not: null } },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return new Set(rows.map((row) => row.studentId));
  }

  if (resource.type === 'QUIZ') {
    const rows = await prisma.quizAttempt.findMany({
      where: { quizId: resource.resourceId },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return new Set(rows.map((row) => row.studentId));
  }

  if (resource.type === 'CODE_EXERCISE') {
    const rows = await prisma.codeSubmission.findMany({
      where: { codeExerciseId: resource.resourceId },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return new Set(rows.map((row) => row.studentId));
  }

  return new Set<string>();
}

function resourceHref(slug: string, type: ModuleItemType, resourceId: string) {
  switch (type) {
    case 'LESSON':
      return `/courses/${slug}/lessons/${resourceId}`;
    case 'ASSIGNMENT':
      return `/courses/${slug}/assignments/${resourceId}`;
    case 'QUIZ':
      return `/courses/${slug}/quizzes/${resourceId}`;
    case 'CODE_EXERCISE':
      return `/courses/${slug}/exercises/${resourceId}`;
    default:
      return `/courses/${slug}/modules`;
  }
}
