import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import {
  getExerciseAction,
  listMyExerciseSubmissionsAction,
  listExerciseSubmissionsAction,
} from '@/actions/exercises';
import { getCodeExerciseRubricAction } from '@/actions/rubric';
import { logActivity } from '@/lib/activity';
import { listCourseNavItemsAction, type CourseNavItem } from '@/actions/modules';
import { ExerciseSubmitPanel } from '@/components/features/code/ExerciseSubmitPanel';
import { TeacherSubmissionsPanel } from '@/components/features/code/TeacherSubmissionsPanel';
import { buttonVariants } from '@/components/ui/button';
import {
  ChevronLeft, ChevronRight, Code2, Pencil, Clock, Cpu,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

const LANG_LABEL: Record<string, string> = {
  PYTHON3: 'Python 3', JAVASCRIPT: 'JavaScript', CPP17: 'C++ 17', WEB: 'Web',
};

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON'        && item.lessonId)        return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT'    && item.assignmentId)    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ'          && item.quizId)          return `/courses/${slug}/quizzes/${item.quizId}`;
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
  const ex = await getExerciseAction(exerciseId);
  return { title: ex?.title ?? 'Bài tập code' };
}

export default async function ExerciseViewPage({
  params,
}: {
  params: Promise<{ slug: string; exerciseId: string }>;
}) {
  const { slug, exerciseId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole;
  const userId  = session?.user?.id;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const exercise = await getExerciseAction(exerciseId);
  if (!exercise || exercise.courseId !== course.id) notFound();

  if (userId) logActivity({ userId, courseId: course.id, action: 'VIEW_EXERCISE', resourceType: 'exercise', resourceId: exerciseId, resourceName: exercise.title });

  const moduleItem = await (async () => {
    const { prisma } = await import('@/lib/db');
    return prisma.moduleItem.findFirst({
      where:   { codeExerciseId: exerciseId, module: { courseId: course.id } },
      include: { module: { select: { name: true } } },
    });
  })();

  const canEdit = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  if (role === 'STUDENT' && exercise.status !== 'PUBLISHED') {
    notFound();
  }

  const isTeacher = hasMinRole(role as UserRole, 'TA');

  const [allNavItems, mySubs, allSubs, rubric] = await Promise.all([
    listCourseNavItemsAction(course.id, role === 'STUDENT'),
    userId ? listMyExerciseSubmissionsAction(exerciseId) : Promise.resolve([]),
    isTeacher ? listExerciseSubmissionsAction(exerciseId) : Promise.resolve([]),
    isTeacher ? getCodeExerciseRubricAction(exerciseId) : Promise.resolve(null),
  ]);

  const currentIndex = allNavItems.findIndex((i) => i.codeExerciseId === exerciseId);
  const prevNavItem  = currentIndex > 0 ? allNavItems[currentIndex - 1] ?? null : null;
  const nextNavItem  = currentIndex < allNavItems.length - 1 ? allNavItems[currentIndex + 1] ?? null : null;

  return (
    <div className="space-y-8">
      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b border-border bg-card">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="ex-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ex-grid)" />
        </svg>
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" style={{ background: 'rgb(139 92 246 / 10%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgb(139 92 246 / 60%), transparent)' }} />

        <div className="relative px-6 py-8">
          <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-violet-400 transition-colors mb-4">
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-violet-400" style={{ filter: 'drop-shadow(0 0 6px #7c3aed)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400">Bài tập code</p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{exercise.title}</h1>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded border border-violet-400/20 bg-violet-400/10 px-2.5 py-0.5 text-xs font-semibold text-violet-400 tracking-wide">
                  <Code2 className="h-3 w-3" /> {LANG_LABEL[exercise.language] ?? exercise.language}
                </span>
                {moduleItem && (
                  <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tracking-wide">
                    {moduleItem.module.name}
                  </span>
                )}
                {allNavItems.length > 1 && currentIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                    Mục {currentIndex + 1}/{allNavItems.length}
                  </span>
                )}
                {exercise.language !== 'WEB' && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {exercise.timeLimit}s
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Cpu className="h-3 w-3" /> {Math.round(exercise.memoryLimit / 1024)} MB
                    </span>
                  </>
                )}
              </div>
            </div>

            {canEdit && (
              <Link href={`/courses/${slug}/exercises/${exerciseId}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Chỉnh sửa
              </Link>
            )}
          </div>
        </div>

        {allNavItems.length > 1 && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-violet-500 transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-[1600px] px-6 mx-auto w-full space-y-8 pb-12">
        {/* Description + sample test cases */}
        {(exercise.description || (exercise.language !== 'WEB' && exercise.testCases.some((tc) => !tc.isHidden))) && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md p-6 space-y-5">
            {exercise.description && (
              <div>
                <h2 className="text-base font-semibold mb-3">Đề bài</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{exercise.description}</p>
              </div>
            )}

            {exercise.language !== 'WEB' && (() => {
              const visible = exercise.testCases.filter((tc) => !tc.isHidden);
              if (visible.length === 0) return null;
              return (
                <div>
                  <h2 className="text-base font-semibold mb-3">Ví dụ</h2>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-b border-border w-1/2">
                            Đầu vào (Input)
                          </th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-b border-border border-l w-1/2">
                            Kết quả mong đợi (Output)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {visible.map((tc) => (
                          <tr key={tc.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 align-top">
                              {tc.label && (
                                <p className="text-xs text-muted-foreground font-medium mb-1">{tc.label}</p>
                              )}
                              <pre className="font-mono text-xs whitespace-pre-wrap break-all bg-muted/40 rounded-md px-2 py-1.5">
                                {tc.input || <span className="italic text-muted-foreground">(trống)</span>}
                              </pre>
                            </td>
                            <td className="px-4 py-3 align-top border-l border-border">
                              <pre className="font-mono text-xs whitespace-pre-wrap break-all bg-muted/40 rounded-md px-2 py-1.5">
                                {tc.expectedOutput || <span className="italic text-muted-foreground">(trống)</span>}
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
          starterHtml={(exercise as any).starterHtml ?? null}
          starterCss={(exercise as any).starterCss   ?? null}
          starterJs={(exercise as any).starterJs     ?? null}
          initialSubs={mySubs}
        />

        {/* Teacher: all student submissions */}
        {isTeacher && (
          <TeacherSubmissionsPanel
            exerciseId={exerciseId}
            language={exercise.language}
            initialSubs={allSubs as any}
            rubric={rubric}
          />
        )}

        {/* Prev / Next */}
        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
          <div className="min-w-0">
            {prevNavItem ? (
              <Link href={navItemUrl(prevNavItem, slug)} className="inline-flex items-center gap-2 sm:gap-3 hover:text-primary transition-colors max-w-full group">
                <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài trước</p>
                  <p className="text-sm font-semibold truncate max-w-[100px] sm:max-w-xs">{prevNavItem.title}</p>
                </div>
              </Link>
            ) : (
              <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
                <ChevronLeft className="h-4 w-4 shrink-0 group-hover:-translate-x-1 transition-transform" />
                <span className="truncate">Về danh sách</span>
              </Link>
            )}
          </div>

          <div className="min-w-0 flex justify-end">
            {nextNavItem && (
              <Link href={navItemUrl(nextNavItem, slug)} className="inline-flex flex-row-reverse items-center gap-2 sm:gap-3 hover:text-primary transition-colors max-w-full text-right group">
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài tiếp theo</p>
                  <p className="text-sm font-semibold truncate max-w-[100px] sm:max-w-xs">{nextNavItem.title}</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
