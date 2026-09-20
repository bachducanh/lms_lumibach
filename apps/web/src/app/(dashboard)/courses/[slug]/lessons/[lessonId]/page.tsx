import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/layouts/PageHero';
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

  const canEdit = course.viewerCanManage;

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
    <div className="w-full space-y-6 pb-12 sm:space-y-8">
      {/* ── Page header ─────────────────────────────────────── */}
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
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm transition-colors duration-150"
        >
          <ChevronLeft className="h-4 w-4" />
          Nội dung khoá học
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64 space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Bài giảng</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {lesson.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold">
                {moduleItem.module.name}
              </span>
              {allNavItems.length > 1 && currentIndex >= 0 && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  Mục {currentIndex + 1}/{allNavItems.length}
                </span>
              )}
              {lesson.estimatedMinutes && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-600/25 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <Clock className="h-3 w-3" /> {lesson.estimatedMinutes} phút
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Đã hoàn thành
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/courses/${slug}/lessons/${lessonId}/edit`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-10')}
              >
                <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
      </PageHero>

      <div className="space-y-6 sm:space-y-8">
        {/* Lesson content */}
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-3.5 sm:px-6 sm:py-4">
            <BookOpen className="h-5 w-5 text-teal-600 dark:text-teal-400" />
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
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-3.5 sm:px-6 sm:py-4">
              <Paperclip className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-bold">File đính kèm</h2>
            </div>
            <div className="p-4 sm:p-6">
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
                    <p className="text-muted-foreground mb-0.5 text-xs font-semibold">Bài trước</p>
                    <p className="truncate text-sm font-semibold sm:max-w-xs">
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
                    <p className="text-muted-foreground mb-0.5 text-xs font-semibold">
                      Bài tiếp theo
                    </p>
                    <p className="truncate text-sm font-semibold sm:max-w-xs">
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
