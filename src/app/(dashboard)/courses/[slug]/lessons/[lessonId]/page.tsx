import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getLessonAction } from '@/actions/lessons';
import { listCourseNavItemsAction, type CourseNavItem } from '@/actions/modules';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { MarkCompleteButton } from '@/components/features/courses/MarkCompleteButton';
import { LessonAttachments } from '@/components/features/courses/LessonAttachments';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { Clock, Pencil, ChevronLeft, ChevronRight, BookOpen, Paperclip, CheckCircle2 } from 'lucide-react';
import type { UserRole } from '@prisma/client';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON'     && item.lessonId)     return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId) return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ'       && item.quizId)       return `/courses/${slug}/quizzes/${item.quizId}`;
  return `/courses/${slug}/modules`;
}

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

  if (userId) logActivity({ userId, courseId: course.id, action: 'VIEW_LESSON', resourceType: 'lesson', resourceId: lessonId, resourceName: lesson.title });

  if (role === 'STUDENT' && !moduleItem.isPublished) notFound();

  const canEdit =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  const completion = userId
    ? await prisma.moduleItemCompletion.findUnique({
        where: { userId_moduleItemId: { userId, moduleItemId: moduleItem.id } },
      })
    : null;

  const allNavItems  = await listCourseNavItemsAction(course.id, role === 'STUDENT');
  const currentIndex = allNavItems.findIndex((i) => i.lessonId === lessonId);
  const prevNavItem  = currentIndex > 0 ? allNavItems[currentIndex - 1] ?? null : null;
  const nextNavItem  = currentIndex < allNavItems.length - 1 ? allNavItems[currentIndex + 1] ?? null : null;

  const isCompleted = !!completion;

  return (
    <div className="space-y-8">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b border-border bg-card">
        {/* Tech grid */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lesson-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lesson-grid)" />
        </svg>

        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" style={{ background: 'rgb(253 8 93 / 10%)' }} />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl" style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }} />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgb(253 8 93 / 60%), transparent)' }} />

        <div className="relative px-6 py-8">
          <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors duration-150 mb-4">
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" style={{ filter: 'drop-shadow(0 0 6px #fd085d)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Bài giảng</p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>
              
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tracking-wide">
                  {moduleItem.module.name}
                </span>
                {allNavItems.length > 1 && currentIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                    Mục {currentIndex + 1}/{allNavItems.length}
                  </span>
                )}
                {lesson.estimatedMinutes && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 tracking-wide">
                    <Clock className="h-3 w-3" /> {lesson.estimatedMinutes} phút
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 tracking-wide">
                    <CheckCircle2 className="h-3 w-3" /> Đã hoàn thành
                  </span>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/courses/${slug}/lessons/${lessonId}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Chỉnh sửa
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        {/* Lesson content */}
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
          <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-bold">Nội dung bài học</h2>
          </div>
          <div className="p-6 md:p-10">
            <div className="prose prose-invert max-w-none">
              <RichTextEditor content={lesson.content} editable={false} className="border-0 bg-transparent p-0 [&_.tiptap]:text-base [&_.tiptap]:leading-relaxed" />
            </div>
          </div>
        </div>

        {/* Attachments */}
        {(lesson.attachments.length > 0 || canEdit) && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
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
        <div className="pt-6 border-t border-border space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Previous link */}
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

            {/* Next link */}
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

          {/* Mark complete button row */}
          {userId && (
            <div className="flex justify-center border-t border-border/40 pt-6 sm:pt-0 sm:border-0">
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
