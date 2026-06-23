import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { MarkCompleteButton } from '@/components/features/courses/MarkCompleteButton';
import { LessonAttachments } from '@/components/features/courses/LessonAttachments';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import {
  Clock,
  Pencil,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import type { CourseDetail, LessonDetail, CourseNavItem } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
  if (item.type === 'PRACTICE_TEST' && item.practiceTestId)
    return `/courses/${slug}/practice-tests/${item.practiceTestId}`;
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
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { lessonId } = await params;
  const api = apiServerClient(await cookies());
  const lesson = await api.get<LessonDetail>(`/lessons/${lessonId}`).catch(() => null);
  return { title: lesson?.title ?? 'Bài giảng' };
}

export default async function LessonViewPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const [course, lesson] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<LessonDetail>(`/lessons/${lessonId}`).catch(() => null),
  ]);
  if (!course) notFound();
  if (!lesson) notFound();

  const moduleItem = lesson.moduleItems.find((item) => item.module.courseId === course.id);
  if (!moduleItem) notFound();

  if (userId)
    logActivity({
      userId,
      courseId: course.id,
      action: 'VIEW_LESSON',
      resourceType: 'lesson',
      resourceId: lessonId,
      resourceName: lesson.title,
    });

  if (role === 'STUDENT' && !moduleItem.isPublished) notFound();

  const canEdit = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  const completion = userId
    ? await prisma.moduleItemCompletion.findUnique({
        where: { userId_moduleItemId: { userId, moduleItemId: moduleItem.id } },
      })
    : null;

  const allNavItems = await api
    .get<CourseNavItem[]>('/modules/nav', {
      query: { courseId: course.id, publishedOnly: role === 'STUDENT' },
    })
    .catch(() => [] as CourseNavItem[]);
  const currentIndex = allNavItems.findIndex((i) => i.lessonId === lessonId);
  const prevNavItem = currentIndex > 0 ? (allNavItems[currentIndex - 1] ?? null) : null;
  const nextNavItem =
    currentIndex < allNavItems.length - 1 ? (allNavItems[currentIndex + 1] ?? null) : null;

  const isCompleted = !!completion;

  return (
    <div className="space-y-8">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="border-border bg-card relative -mx-4 -mt-4 overflow-hidden border-b md:-mx-6 md:-mt-6">
        {/* Tech grid */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="lesson-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lesson-grid)" />
        </svg>

        {/* Glow accents */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgb(253 8 93 / 10%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl"
          style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 right-0 left-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(253 8 93 / 60%), transparent)',
          }}
        />

        <div className="relative px-4 py-6 sm:px-6 sm:py-8">
          <Link
            href={`/courses/${slug}/modules`}
            className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase transition-colors duration-150"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen
                  className="text-primary h-3.5 w-3.5"
                  style={{ filter: 'drop-shadow(0 0 6px #fd085d)' }}
                />
                <p className="text-primary text-[11px] font-bold tracking-[0.2em] uppercase">
                  Bài giảng
                </p>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                  {moduleItem.module.name}
                </span>
                {allNavItems.length > 1 && currentIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                    Mục {currentIndex + 1}/{allNavItems.length}
                  </span>
                )}
                {lesson.estimatedMinutes && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-500">
                    <Clock className="h-3 w-3" /> {lesson.estimatedMinutes} phút
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Đã hoàn thành
                  </span>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/courses/${slug}/lessons/${lessonId}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && (
          <div className="bg-muted h-1">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 pb-12">
        {/* Lesson content */}
        <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
          <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
            <BookOpen className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-bold">Nội dung bài học</h2>
          </div>
          <div className="p-4 sm:p-6 md:p-10">
            <RichTextEditor
              content={lesson.content}
              editable={false}
              className="border-0 bg-transparent p-0 [&_.tiptap]:text-base [&_.tiptap]:leading-relaxed"
            />
          </div>
        </div>

        {/* Attachments */}
        {(lesson.attachments.length > 0 || canEdit) && (
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
            <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
              <Paperclip className="h-5 w-5 text-teal-500" />
              <h2 className="text-lg font-bold">File đính kèm</h2>
            </div>
            <div className="p-6">
              <LessonAttachments
                lessonId={lessonId}
                initialAttachments={lesson.attachments}
                canEdit={canEdit}
              />
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="border-border space-y-6 border-t pt-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Previous link */}
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

            {/* Next link */}
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

          {/* Mark complete button row */}
          {userId && (
            <div className="border-border/40 flex justify-center border-t pt-6 sm:border-0 sm:pt-0">
              <div className="w-full sm:w-auto">
                <MarkCompleteButton
                  moduleItemId={moduleItem.id}
                  isCompleted={isCompleted}
                  courseSlug={slug}
                  lessonId={lessonId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
