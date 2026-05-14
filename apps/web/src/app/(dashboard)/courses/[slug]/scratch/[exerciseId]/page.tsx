import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, CourseNavItem } from '@lumibach/types';
import { logActivity } from '@/lib/activity';
import { hasMinRole } from '@/lib/permissions';
import { listMyScratchSubmissionsAction, listScratchSubmissionsAction } from '@/actions/scratch';
import type { RubricData } from '@lumibach/types';
import { ScratchTakePanel } from '@/components/features/scratch/ScratchTakePanel';
import { ScratchTeacherPanel } from '@/components/features/scratch/ScratchTeacherPanel';
import { buttonVariants } from '@/components/ui/button';
import { Cat, ChevronLeft, ChevronRight, Pencil, Sparkles } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
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

  const canEdit = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
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
    listMyScratchSubmissionsAction(exerciseId),
    isTeacher ? listScratchSubmissionsAction(exerciseId) : Promise.resolve([]),
    isTeacher
      ? api.get<RubricData>(`/rubrics/code-exercise/${exerciseId}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const currentIndex = allNavItems.findIndex((i) => i.codeExerciseId === exerciseId);
  const prevNavItem = currentIndex > 0 ? (allNavItems[currentIndex - 1] ?? null) : null;
  const nextNavItem =
    currentIndex < allNavItems.length - 1 ? (allNavItems[currentIndex + 1] ?? null) : null;

  return (
    <div className="space-y-8">
      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="border-border bg-card relative -mx-6 -mt-6 overflow-hidden border-b">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="scratch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#scratch-grid)" />
        </svg>
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgb(255 141 42 / 12%)' }}
        />
        <div
          className="absolute top-0 right-0 left-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(255 141 42 / 70%), transparent)',
          }}
        />

        <div className="relative px-6 py-8">
          <Link
            href={`/courses/${slug}/modules`}
            className="text-muted-foreground mb-4 inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase transition-colors hover:text-orange-400"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Cat
                  className="h-3.5 w-3.5 text-orange-400"
                  style={{ filter: 'drop-shadow(0 0 6px #ff8d2a)' }}
                />
                <p className="text-[11px] font-bold tracking-[0.2em] text-orange-400 uppercase">
                  Bài Scratch
                </p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{exercise.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded border border-orange-400/20 bg-orange-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-orange-400">
                  <Sparkles className="h-3 w-3" /> Scratch 3
                </span>
                {moduleItem && (
                  <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                    {moduleItem.module.name}
                  </span>
                )}
                {allNavItems.length > 1 && currentIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                    Mục {currentIndex + 1}/{allNavItems.length}
                  </span>
                )}
              </div>
            </div>

            {canEdit && (
              <Link
                href={`/courses/${slug}/scratch/${exerciseId}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
              </Link>
            )}
          </div>
        </div>

        {allNavItems.length > 1 && (
          <div className="bg-muted h-1">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-6 pb-12">
        {/* Description */}
        {exercise.description && (
          <div className="border-border/60 bg-card/40 rounded-2xl border p-6 backdrop-blur-md">
            <h2 className="mb-3 text-base font-semibold">Đề bài</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {exercise.description}
            </p>
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
                  <p className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Bài trước
                  </p>
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
                  <p className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
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
