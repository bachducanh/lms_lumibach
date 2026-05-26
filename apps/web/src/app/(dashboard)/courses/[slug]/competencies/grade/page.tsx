import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { ActivityCompetencyWorkspace } from '@/components/features/competencies/ActivityCompetencyWorkspace';
import { ArrowLeft, Target } from 'lucide-react';
import type { ActivityType, CourseDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chấm năng lực' };
export const dynamic = 'force-dynamic';

const ACTIVITY_TYPES = ['assignment', 'quiz', 'code-exercise', 'practice-test'] as const;

type ActivityMeta = {
  id: string;
  courseId: string;
  title: string;
};

function isActivityType(value: string | undefined): value is ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType);
}

function activityPath(activityType: ActivityType, activityId: string) {
  switch (activityType) {
    case 'assignment':
      return `/assignments/${activityId}`;
    case 'quiz':
      return `/quizzes/${activityId}`;
    case 'code-exercise':
      return `/code-exercises/${activityId}`;
    case 'practice-test':
      return `/practice-tests/${activityId}`;
  }
}

export default async function CompetencyGradePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ activityType?: string; activityId?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;
  if (!role || !userId) redirect('/login');
  if (!hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  if (!isActivityType(sp.activityType) || !sp.activityId) notFound();

  const api = apiServerClient(await cookies());
  const [course, activity] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<ActivityMeta>(activityPath(sp.activityType, sp.activityId)).catch(() => null),
  ]);
  if (!course || !activity || activity.courseId !== course.id) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.name}
      </Link>

      <div className="flex items-center gap-2">
        <Target className="text-primary h-4 w-4" />
        <p className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
          Trang chấm năng lực riêng
        </p>
      </div>

      <ActivityCompetencyWorkspace
        courseId={course.id}
        courseSlug={slug}
        activityType={sp.activityType}
        activityId={sp.activityId}
        canManage={canManage}
        activityTitle={activity.title}
      />
    </div>
  );
}
