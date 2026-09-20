import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient, orNotFound } from '@/lib/api-client';
import type { CourseDetail, CourseNavItem } from '@lumibach/types';
import type {
  CodeExerciseDetail,
  MyExerciseSubmission,
  ExerciseSubmissionDetail,
} from '@lumibach/types';
import type { RubricData } from '@lumibach/types';
import { logActivity } from '@/lib/activity';
import { ExerciseSubmitPanel } from '@/components/features/code/ExerciseSubmitPanel';
import { TeacherSubmissionsPanel } from '@/components/features/code/TeacherSubmissionsPanel';
import { ActivityCompetencyPanel } from '@/components/features/competencies/ActivityCompetencyPanel';
import { buttonVariants } from '@/components/ui/button';
import { PageHero } from '@/components/layouts/PageHero';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { ChevronLeft, ChevronRight, Code2, Pencil, Clock, Cpu } from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

const LANG_LABEL: Record<string, string> = {
  PYTHON3: 'Python 3',
  JAVASCRIPT: 'JavaScript',
  CPP17: 'C++ 17',
  WEB: 'Web',
};

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
  const api = apiServerClient(await cookies());
  const ex = await api.get<CodeExerciseDetail>(`/code-exercises/${exerciseId}`).catch(() => null);
  return { title: ex?.title ?? 'Bài tập code' };
}

export default async function ExerciseViewPage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const course = await orNotFound(api.get<CourseDetail>(`/courses/${slug}`));
  if (!course) notFound();

  const exercise = await orNotFound(api.get<CodeExerciseDetail>(`/code-exercises/${exerciseId}`));
  if (!exercise || exercise.courseId !== course.id) notFound();

  if (userId)
    logActivity({
      userId,
      courseId: course.id,
      action: 'VIEW_EXERCISE',
      resourceType: 'exercise',
      resourceId: exerciseId,
      resourceName: exercise.title,
    });

  const moduleItem = await (async () => {
    const { prisma } = await import('@/lib/db');
    return prisma.moduleItem.findFirst({
      where: { codeExerciseId: exerciseId, module: { courseId: course.id } },
      include: { module: { select: { name: true } } },
    });
  })();

  const canEdit = course.viewerCanManage;

  if (role === 'STUDENT' && exercise.status !== 'PUBLISHED') {
    notFound();
  }

  const isTeacher = hasMinRole(role as UserRole, 'TA');

  const [allNavItems, mySubs, allSubs, rubric] = await Promise.all([
    api
      .get<
        CourseNavItem[]
      >('/modules/nav', { query: { courseId: course.id, publishedOnly: role === 'STUDENT' } })
      .catch(() => [] as CourseNavItem[]),
    userId
      ? api
          .get<MyExerciseSubmission[]>(`/code-exercises/${exerciseId}/my-submissions`)
          .catch(() => [] as MyExerciseSubmission[])
      : Promise.resolve([] as MyExerciseSubmission[]),
    isTeacher
      ? api
          .get<ExerciseSubmissionDetail[]>(`/code-exercises/${exerciseId}/submissions`)
          .catch(() => [] as ExerciseSubmissionDetail[])
      : Promise.resolve([] as ExerciseSubmissionDetail[]),
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
              <Code2 className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Bài tập code</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {exercise.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-600/25 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-400">
                <Code2 className="h-3 w-3" /> {LANG_LABEL[exercise.language] ?? exercise.language}
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
              {exercise.language !== 'WEB' && (
                <>
                  <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                    <Clock className="h-3 w-3" /> {exercise.timeLimit}s
                  </span>
                  <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                    <Cpu className="h-3 w-3" /> {Math.round(exercise.memoryLimit / 1024)} MB
                  </span>
                </>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href={`/courses/${slug}/exercises/${exerciseId}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
      </PageHero>

      <div className="space-y-8">
        {/* Description + sample test cases */}
        {(exercise.description ||
          (exercise.language !== 'WEB' && exercise.testCases.some((tc) => !tc.isHidden))) && (
          <div className="border-border bg-card space-y-5 rounded-xl border p-4 shadow-sm sm:p-6">
            {exercise.description && (
              <div>
                <h2 className="mb-3 text-base font-semibold">Đề bài</h2>
                <RichTextView html={exercise.description} className="text-muted-foreground" />
              </div>
            )}

            {exercise.language !== 'WEB' &&
              (() => {
                const visible = exercise.testCases.filter((tc) => !tc.isHidden);
                if (visible.length === 0) return null;
                return (
                  <div>
                    <h2 className="mb-3 text-base font-semibold">Ví dụ</h2>
                    <div className="border-border overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-muted-foreground border-border w-1/2 border-b px-4 py-2.5 text-left text-xs font-semibold">
                              Đầu vào (Input)
                            </th>
                            <th className="text-muted-foreground border-border w-1/2 border-b border-l px-4 py-2.5 text-left text-xs font-semibold">
                              Kết quả mong đợi (Output)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                          {visible.map((tc) => (
                            <tr key={tc.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3 align-top">
                                {tc.label && (
                                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                                    {tc.label}
                                  </p>
                                )}
                                <pre className="bg-muted/40 rounded-md px-2 py-1.5 font-mono text-xs break-all whitespace-pre-wrap">
                                  {tc.input || (
                                    <span className="text-muted-foreground italic">(trống)</span>
                                  )}
                                </pre>
                              </td>
                              <td className="border-border border-l px-4 py-3 align-top">
                                <pre className="bg-muted/40 rounded-md px-2 py-1.5 font-mono text-xs break-all whitespace-pre-wrap">
                                  {tc.expectedOutput || (
                                    <span className="text-muted-foreground italic">(trống)</span>
                                  )}
                                </pre>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Submit panel */}
        <ExerciseSubmitPanel
          exerciseId={exerciseId}
          language={exercise.language}
          starterCode={exercise.starterCode ?? ''}
          starterHtml={exercise.starterHtml ?? null}
          starterCss={exercise.starterCss ?? null}
          starterJs={exercise.starterJs ?? null}
          initialSubs={mySubs}
        />

        {/* Teacher: all student submissions */}
        {isTeacher && (
          <TeacherSubmissionsPanel
            exerciseId={exerciseId}
            language={exercise.language}
            initialSubs={allSubs}
            rubric={rubric}
          />
        )}

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
