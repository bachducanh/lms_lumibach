import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getLessonAction } from '@/actions/lessons';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { MarkCompleteButton } from '@/components/features/courses/MarkCompleteButton';
import { LessonAttachments } from '@/components/features/courses/LessonAttachments';
import { prisma } from '@/lib/db';
import { Clock, Pencil, ChevronLeft, ChevronRight, LayoutList, Paperclip } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = await getLessonAction(lessonId);
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

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const lesson = await getLessonAction(lessonId);
  if (!lesson) notFound();

  const moduleItem = lesson.moduleItems.find((item) => item.module.courseId === course.id);
  if (!moduleItem) notFound();

  if (role === 'STUDENT' && !moduleItem.isPublished) notFound();

  const canEdit =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  const completion = userId
    ? await prisma.moduleItemCompletion.findUnique({
        where: { userId_moduleItemId: { userId, moduleItemId: moduleItem.id } },
      })
    : null;

  const allItems = await prisma.moduleItem.findMany({
    where: {
      moduleId: moduleItem.moduleId,
      type: 'LESSON',
      ...(role === 'STUDENT' ? { isPublished: true } : {}),
    },
    orderBy: { position: 'asc' },
    select: { id: true, lessonId: true, title: true },
  });

  const currentIndex = allItems.findIndex((i) => i.lessonId === lessonId);
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  const isCompleted = !!completion;

  return (
    <div className="min-h-full">
      {/* Top nav bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/courses/${slug}/modules`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">Nội dung</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium truncate">{lesson.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lesson.estimatedMinutes && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {lesson.estimatedMinutes} phút
            </span>
          )}
          {canEdit && (
            <Link
              href={`/courses/${slug}/lessons/${lessonId}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Sửa
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar — current position */}
      {allItems.length > 1 && (
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / allItems.length) * 100}%` }}
          />
        </div>
      )}

      {/* Content area */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Title section */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <span>{moduleItem.module.name}</span>
            {allItems.length > 1 && (
              <>
                <span>·</span>
                <span>Bài {currentIndex + 1}/{allItems.length}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">{lesson.title}</h1>

          {/* Status pill */}
          {isCompleted && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Đã hoàn thành
            </div>
          )}
        </div>

        {/* Lesson content */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6 sm:p-8">
            <RichTextEditor content={lesson.content} editable={false} className="border-0 bg-transparent [&_.tiptap]:text-base [&_.tiptap]:leading-relaxed" />
          </div>
        </div>

        {/* Attachments */}
        {(lesson.attachments.length > 0 || canEdit) && (
          <div className="mt-8 rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-base font-semibold mb-4">
              <Paperclip className="h-4 w-4" />
              File đính kèm
            </h2>
            <LessonAttachments
              lessonId={lessonId}
              initialAttachments={lesson.attachments}
              canEdit={canEdit}
            />
          </div>
        )}

        {/* Bottom action bar */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {/* Prev */}
          <div>
            {prevItem?.lessonId ? (
              <Link
                href={`/courses/${slug}/lessons/${prevItem.lessonId}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="max-w-30 truncate hidden sm:inline">{prevItem.title}</span>
                <span className="sm:hidden">Bài trước</span>
              </Link>
            ) : (
              <Link
                href={`/courses/${slug}/modules`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Nội dung
              </Link>
            )}
          </div>

          {/* Mark complete / Next */}
          <div className="flex items-center gap-2">
            {userId && (
              <MarkCompleteButton
                moduleItemId={moduleItem.id}
                isCompleted={isCompleted}
                courseSlug={slug}
                lessonId={lessonId}
              />
            )}
            {nextItem?.lessonId && (
              <Link
                href={`/courses/${slug}/lessons/${nextItem.lessonId}`}
                className={buttonVariants({ size: 'sm' })}
              >
                <span className="max-w-30 truncate hidden sm:inline">{nextItem.title}</span>
                <span className="sm:hidden">Bài tiếp</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
