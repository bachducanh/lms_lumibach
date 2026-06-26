import Link from 'next/link';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { ArrowLeft, Layers, Zap } from 'lucide-react';
import type { CourseDetail, ModuleWithItems } from '@lumibach/types';
import type { UserRole, SubmissionStatus, AttemptStatus } from '@lumibach/db';
import { ModuleListClient } from '@/components/features/courses/ModuleListClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: `Nội dung — ${course?.name ?? 'Khoá học'}` };
}

export default async function CourseModulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const isStudent = role === 'STUDENT';
  const canManage = course.viewerCanManage;

  if (isStudent && course.status !== 'PUBLISHED') {
    redirect(`/courses/${slug}`);
  }

  const [
    modules,
    completions,
    submittedAssignments,
    submittedQuizzes,
    submittedPracticeTests,
    submittedCodeExercises,
  ] = await Promise.all([
    api
      .get<ModuleWithItems[]>('/modules', {
        query: { courseId: course.id, publishedOnly: isStudent },
      })
      .catch(() => [] as ModuleWithItems[]),
    userId
      ? prisma.moduleItemCompletion.findMany({
          where: { userId, moduleItem: { module: { courseId: course.id } } },
          select: { moduleItemId: true },
        })
      : Promise.resolve([]),
    isStudent && userId
      ? prisma.submission.findMany({
          where: {
            studentId: userId,
            status: { in: ['SUBMITTED', 'LATE', 'GRADED', 'RETURNED'] as SubmissionStatus[] },
            assignment: { courseId: course.id },
          },
          select: { assignmentId: true },
        })
      : Promise.resolve([]),
    isStudent && userId
      ? prisma.quizAttempt.findMany({
          where: {
            studentId: userId,
            status: { in: ['SUBMITTED', 'GRADED'] as AttemptStatus[] },
            quiz: { courseId: course.id },
          },
          select: { quizId: true },
        })
      : Promise.resolve([]),
    isStudent && userId
      ? prisma.practiceTestAttempt.findMany({
          where: {
            studentId: userId,
            practiceTest: { courseId: course.id },
          },
          select: { practiceTestId: true },
          distinct: ['practiceTestId'],
        })
      : Promise.resolve([]),
    isStudent && userId
      ? prisma.codeSubmission.findMany({
          where: { studentId: userId, codeExercise: { courseId: course.id } },
          select: { codeExerciseId: true },
          distinct: ['codeExerciseId'],
        })
      : Promise.resolve([]),
  ]);

  const completedIds = new Set(completions.map((c) => c.moduleItemId));
  const submittedAssignmentIds = new Set(submittedAssignments.map((s) => s.assignmentId));
  const submittedQuizIds = new Set(submittedQuizzes.map((a) => a.quizId));
  const submittedPracticeTestIds = new Set(submittedPracticeTests.map((a) => a.practiceTestId));
  const submittedCodeExerciseIds = new Set(submittedCodeExercises.map((s) => s.codeExerciseId));
  const totalItems = modules.reduce((s, m) => s + m.items.length, 0);

  return (
    <div className="space-y-6">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="border-border bg-card relative -mx-4 -mt-4 mb-8 overflow-hidden border-b md:-mx-6 md:-mt-6">
        {/* Tech grid */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="modules-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#modules-grid)" />
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
            href={`/courses/${slug}`}
            className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase transition-colors duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {course.name}
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers
                  className="text-primary h-3.5 w-3.5"
                  style={{ filter: 'drop-shadow(0 0 6px #fd085d)' }}
                />
                <p className="text-primary text-[11px] font-bold tracking-[0.2em] uppercase">
                  Giáo trình
                </p>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nội dung khoá học</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                  <Zap className="h-3 w-3" /> {modules.length} chương
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                  {totalItems} bài học
                </span>
                {isStudent && completedIds.size > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-400">
                    {completedIds.size}/{totalItems} hoàn thành
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <ModuleListClient
          courseSlug={slug}
          courseId={course.id}
          modules={modules}
          canManage={canManage}
          completedIds={completedIds}
          submittedAssignmentIds={submittedAssignmentIds}
          submittedQuizIds={submittedQuizIds}
          submittedPracticeTestIds={submittedPracticeTestIds}
          submittedCodeExerciseIds={submittedCodeExerciseIds}
        />
      </div>
    </div>
  );
}
