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
import { PageHero } from '@/components/layouts/PageHero';
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
    <div className="w-full space-y-6">
      {/* ── Page header ─────────────────────────────────────── */}
      <PageHero>
        <Link
          href={`/courses/${slug}`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors duration-150"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="min-w-0 break-words">{course.name}</span>
        </Link>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="text-primary h-4 w-4" />
            <p className="text-primary text-sm font-semibold">Giáo trình</p>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Nội dung khoá học
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-primary/20 bg-primary/10 text-primary inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold">
              <Zap className="h-3 w-3" /> {modules.length} chương
            </span>
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
              {totalItems} bài học
            </span>
            {isStudent && completedIds.size > 0 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                {completedIds.size}/{totalItems} hoàn thành
              </span>
            )}
          </div>
        </div>
      </PageHero>

      <ModuleListClient
        courseSlug={slug}
        courseId={course.id}
        modules={modules}
        canManage={canManage}
        modulesExpandedByDefault={course.modulesExpandedByDefault}
        completedIds={completedIds}
        submittedAssignmentIds={submittedAssignmentIds}
        submittedQuizIds={submittedQuizIds}
        submittedPracticeTestIds={submittedPracticeTestIds}
        submittedCodeExerciseIds={submittedCodeExerciseIds}
      />
    </div>
  );
}
