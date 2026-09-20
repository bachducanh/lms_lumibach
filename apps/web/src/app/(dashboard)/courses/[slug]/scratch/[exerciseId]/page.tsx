import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, CourseNavItem } from '@lumibach/types';
import { logActivity } from '@/lib/activity';
import { hasMinRole } from '@/lib/permissions';
import type { MyScratchSubmission, ScratchSubmissionWithStudent } from '@lumibach/types';
import type { RubricData } from '@lumibach/types';
import { ScratchTakePanel } from '@/components/features/scratch/ScratchTakePanel';
import { ScratchTeacherPanel } from '@/components/features/scratch/ScratchTeacherPanel';
import { ActivityCompetencyPanel } from '@/components/features/competencies/ActivityCompetencyPanel';
import { buttonVariants } from '@/components/ui/button';
import { PageHero } from '@/components/layouts/PageHero';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { Cat, ChevronLeft, ChevronRight, Pencil, Sparkles } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
  if (item.type === 'PRACTICE_TEST' && item.practiceTestId)
    return `/courses/${slug}/practice-tests/${item.practiceTestId}`;
  if (item.type === 'FORUM' && item.forumId)
    return `/courses/${slug}/forum?forumId=${item.forumId}`;
  if (item.type === 'CODE_EXERCISE' && item.codeExerciseId) {
    return item.codeExercise?.language === 'SCRATCH'
      ? `/courses/${slug}/scratch/${item.codeExerciseId}`
      : `/courses/${slug}/exercises/${item.codeExerciseId}`;
  }
  return `/courses/${slug}/modules`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const ex = await prisma.codeExercise.findUnique({
    where: { id: exerciseId, deletedAt: null },
    select: { title: true },
  });
  return { title: ex?.title ?? 'Bài Scratch' };
}

export default async function ScratchExercisePage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const exercise = await prisma.codeExercise.findUnique({
    where: { id: exerciseId, deletedAt: null },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      language: true,
      status: true,
      starterFileUrl: true,
    },
  });
  if (!exercise || exercise.courseId !== course.id) notFound();
  if (exercise.language !== 'SCRATCH') {
    redirect(`/courses/${slug}/exercises/${exerciseId}`);
  }

  const canEdit = course.viewerCanManage;
  const isTeacher = !!role && hasMinRole(role, 'TA');

  if (role === 'STUDENT' && exercise.status !== 'PUBLISHED') notFound();

  logActivity({
    userId,
    courseId: course.id,
    action: 'VIEW_EXERCISE',
    resourceType: 'exercise',
    resourceId: exerciseId,
    resourceName: exercise.title,
  });

  const moduleItem = await prisma.moduleItem.findFirst({
    where: { codeExerciseId: exerciseId, module: { courseId: course.id } },
    include: { module: { select: { name: true } } },
  });

  const [allNavItems, mySubs, allSubs, rubric] = await Promise.all([
    api
      .get<
        CourseNavItem[]
      >('/modules/nav', { query: { courseId: course.id, publishedOnly: role === 'STUDENT' } })
      .catch(() => [] as CourseNavItem[]),
    api
      .get<MyScratchSubmission[]>(`/scratch/${exerciseId}/my-submissions`)
      .catch(() => [] as MyScratchSubmission[]),
    isTeacher
      ? api
          .get<ScratchSubmissionWithStudent[]>(`/scratch/${exerciseId}/submissions`)
          .catch(() => [] as ScratchSubmissionWithStudent[])
      : Promise.resolve([] as ScratchSubmissionWithStudent[]),
    isTeacher
      ? api.get<RubricData>(`/rubrics/code-exercise/${exerciseId}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const currentIndex = allNavItems.findIndex((i) => i.codeExerciseId === exerciseId);
  const prevNavItem = currentIndex > 0 ? (allNavItems[currentIndex - 1] ?? null) : null;
  const nextNavItem =
    currentIndex < allNavItems.length - 1 ? (allNavItems[currentIndex + 1] ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-12">
      {/* ── Hero header ─────────────────────────────────────── */}
      <PageHero
        footer={
          allNavItems.length > 1 ? (
            <div className="bg-muted h-1">
              <div
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${((currentIndex + 1) / allNavItems.length) * 100}%` }}
              />
            </div>
          ) : null
        }
      >
        <Link
          href={`/courses/${slug}/modules`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Nội dung khoá học
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Cat className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Bài Scratch</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {exercise.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                <Sparkles className="h-3 w-3" /> Scratch 3
              </span>
              {moduleItem && (
                <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  {moduleItem.module.name}
                </span>
              )}
              {allNavItems.length > 1 && currentIndex >= 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  Mục {currentIndex + 1}/{allNavItems.length}
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href={`/courses/${slug}/scratch/${exerciseId}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
      </PageHero>

      <div className="space-y-8">
        {/* Description */}
        {exercise.description && (
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 text-base font-semibold">Đề bài</h2>
            <RichTextView html={exercise.description} className="text-muted-foreground" />
          </div>
        )}

        {/* Student panel — embedded Scratch editor + auto-submit */}
        <ScratchTakePanel
          exerciseId={exerciseId}
          starterUrl={exercise.starterFileUrl}
          initialSubs={mySubs}
        />

        {/* Teacher review panel */}
        {isTeacher && <ScratchTeacherPanel submissions={allSubs} rubric={rubric} />}

        {/* Competency assessment — staff only */}
        {isTeacher && (
          <ActivityCompetencyPanel
            courseId={course.id}
            courseSlug={slug}
            activityType="code-exercise"
            activityId={exerciseId}
            canManage={canEdit}
          />
        )}

        {/* Prev / Next */}
        <div className="border-border grid grid-cols-2 gap-4 border-t pt-6">
          <div className="min-w-0">
            {prevNavItem ? (
              <Link
                href={navItemUrl(prevNavItem, slug)}
                className="hover:text-primary group inline-flex max-w-full items-center gap-2 transition-colors sm:gap-3"
              >
                <ChevronLeft className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-all group-hover:-translate-x-1" />
                <div className="min-w-0">
                  <p className="text-muted-foreground mb-0.5 text-xs font-semibold">Bài trước</p>
                  <p className="max-w-[100px] truncate text-sm font-semibold sm:max-w-xs">
                    {prevNavItem.title}
                  </p>
                </div>
              </Link>
            ) : (
              <Link
                href={`/courses/${slug}/modules`}
                className="text-muted-foreground hover:text-primary group inline-flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
                <span className="truncate">Về danh sách</span>
              </Link>
            )}
          </div>

          <div className="flex min-w-0 justify-end">
            {nextNavItem && (
              <Link
                href={navItemUrl(nextNavItem, slug)}
                className="hover:text-primary group inline-flex max-w-full flex-row-reverse items-center gap-2 text-right transition-colors sm:gap-3"
              >
                <ChevronRight className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-all group-hover:translate-x-1" />
                <div className="min-w-0">
                  <p className="text-muted-foreground mb-0.5 text-xs font-semibold">
                    Bài tiếp theo
                  </p>
                  <p className="max-w-[100px] truncate text-sm font-semibold sm:max-w-xs">
                    {nextNavItem.title}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
