import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient, orNotFound } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import { PageHero } from '@/components/layouts/PageHero';
import { hasMinRole } from '@/lib/permissions';
import { PracticeTestRunner } from '@/components/features/practice-tests/PracticeTestRunner';
import { SebLockScreen } from '@/components/features/seb/SebLockScreen';
import { isSafeExamBrowser, sebConfigPath, sebLaunchUrl } from '@/lib/seb';
import { PracticeTestStatusButton } from '@/components/features/practice-tests/PracticeTestStatusButton';
import { DeletePracticeTestButton } from '@/components/features/practice-tests/DeletePracticeTestButton';
import { ActivityCompetencyPanel } from '@/components/features/competencies/ActivityCompetencyPanel';
import type {
  CourseNavItem,
  CourseDetail,
  PracticeAttemptListItem,
  PracticeTestDetail,
  PracticeTestQuestion,
} from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FileQuestion,
  History,
  RotateCcw,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { groupBySection } from '@/lib/practice-test-utils';
import { formatDateTime } from '@/lib/datetime';

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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  CLOSED: 'Đã đóng',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'border-border bg-muted text-muted-foreground',
  PUBLISHED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  CLOSED: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function fmt(d: string | Date | null | undefined) {
  return formatDateTime(d);
}

function totalPoints(questions: PracticeTestQuestion[]) {
  return questions.reduce((sum, question) => sum + question.points, 0);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string }>;
}) {
  const { practiceTestId } = await params;
  const api = apiServerClient(await cookies());
  const practiceTest = await api
    .get<PracticeTestDetail>(`/practice-tests/${practiceTestId}`)
    .catch(() => null);
  return { title: practiceTest?.title ?? 'Đề luyện tập' };
}

export default async function PracticeTestPage({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string }>;
}) {
  const { slug, practiceTestId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;
  if (!role || !userId) redirect('/login');

  const api = apiServerClient(await cookies());
  const [course, practiceTest] = await Promise.all([
    orNotFound(api.get<CourseDetail>(`/courses/${slug}`)),
    orNotFound(api.get<PracticeTestDetail>(`/practice-tests/${practiceTestId}`)),
  ]);
  if (!course || !practiceTest) notFound();
  if (practiceTest.courseId !== course.id) notFound();

  const isStaff = hasMinRole(role, 'TA');
  const canManage = course.viewerCanManage;
  if (!isStaff && practiceTest.status !== 'PUBLISHED') notFound();

  const [myAttempts, allAttempts, allNavItems] = await Promise.all([
    role === 'STUDENT'
      ? api
          .get<PracticeAttemptListItem[]>(`/practice-tests/${practiceTestId}/my-attempts`)
          .catch(() => [] as PracticeAttemptListItem[])
      : Promise.resolve([] as PracticeAttemptListItem[]),
    isStaff
      ? api
          .get<PracticeAttemptListItem[]>(`/practice-tests/${practiceTestId}/attempts`)
          .catch(() => [] as PracticeAttemptListItem[])
      : Promise.resolve([] as PracticeAttemptListItem[]),
    api
      .get<CourseNavItem[]>('/modules/nav', {
        query: { courseId: course.id, publishedOnly: !isStaff },
      })
      .catch(() => [] as CourseNavItem[]),
  ]);
  const currentNavIndex = allNavItems.findIndex((item) => item.practiceTestId === practiceTestId);
  const progressBar = (
    <ActivityProgress currentIndex={currentNavIndex} total={allNavItems.length} />
  );
  const prevNavItem = currentNavIndex > 0 ? (allNavItems[currentNavIndex - 1] ?? null) : null;
  const nextNavItem =
    currentNavIndex >= 0 && currentNavIndex < allNavItems.length - 1
      ? (allNavItems[currentNavIndex + 1] ?? null)
      : null;

  const now = new Date();
  const isAvailable = !practiceTest.availableFrom || now >= new Date(practiceTest.availableFrom);
  const isPastDue = practiceTest.dueDate ? now > new Date(practiceTest.dueDate) : false;
  const attemptLimitReached =
    !!practiceTest.maxAttempts && myAttempts.length >= practiceTest.maxAttempts;

  if (!isStaff) {
    if (!isAvailable || isPastDue || attemptLimitReached) {
      return (
        <div className="space-y-4">
          {progressBar}
          <StudentBlockedView
            slug={slug}
            practiceTest={practiceTest}
            myAttempts={myAttempts}
            reason={
              !isAvailable
                ? `Đề sẽ mở lúc ${fmt(practiceTest.availableFrom)}.`
                : isPastDue
                  ? 'Đề luyện tập đã hết hạn.'
                  : 'Bạn đã dùng hết số lần làm bài.'
            }
          />
        </div>
      );
    }

    // Chế độ kiểm tra Safe Exam Browser: học sinh phải mở bài bằng SEB.
    if (practiceTest.sebEnabled) {
      const reqHeaders = await headers();
      if (!isSafeExamBrowser(reqHeaders)) {
        return (
          <div className="space-y-4">
            {progressBar}
            <SebLockScreen
              title={practiceTest.title}
              launchUrl={sebLaunchUrl(reqHeaders, 'practice-test', practiceTestId)}
              downloadUrl={sebConfigPath('practice-test', practiceTestId)}
            />
          </div>
        );
      }
    }

    return (
      <div className="space-y-4">
        {progressBar}
        <PracticeTestRunner practiceTest={practiceTest} courseSlug={slug} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        footer={
          allNavItems.length > 1 && currentNavIndex >= 0 ? (
            <div className="bg-muted h-1">
              <div
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
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
              <FileQuestion className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Đề luyện tập PDF</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {practiceTest.title}
            </h1>
            {practiceTest.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                {practiceTest.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canManage && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_CLASS[practiceTest.status]
                  )}
                >
                  {STATUS_LABEL[practiceTest.status]}
                </span>
              )}
              {allNavItems.length > 1 && currentNavIndex >= 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  Mục {currentNavIndex + 1}/{allNavItems.length}
                </span>
              )}
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                <FileQuestion className="h-3 w-3" /> {practiceTest.questions.length} câu
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                <Target className="h-3 w-3" /> {totalPoints(practiceTest.questions)} điểm
              </span>
              {practiceTest.timeLimit && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/25 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <Clock className="h-3 w-3" /> {practiceTest.timeLimit} phút
                </span>
              )}
              {practiceTest.maxAttempts && (
                <span className="border-muted-foreground/20 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  <RotateCcw className="h-3 w-3" /> Tối đa {practiceTest.maxAttempts} lần
                </span>
              )}
              {practiceTest.dueDate && (
                <span className="border-destructive/20 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  <CalendarDays className="h-3 w-3" /> Hạn: {fmt(practiceTest.dueDate)}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={`/courses/${slug}/practice-tests/${practiceTestId}/preview`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Eye className="mr-1.5 h-4 w-4" />
              Xem thử
            </Link>
            {canManage && (
              <>
                <PracticeTestStatusButton
                  practiceTestId={practiceTestId}
                  isPublished={practiceTest.status === 'PUBLISHED'}
                />
                <Link
                  href={`/courses/${slug}/practice-tests/${practiceTestId}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Edit3 className="mr-1.5 h-4 w-4" />
                  Chỉnh sửa
                </Link>
                <Link
                  href={`/courses/${slug}/practice-tests/${practiceTestId}/attempts`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Users className="mr-1.5 h-4 w-4" />
                  Bài làm
                </Link>
                <DeletePracticeTestButton practiceTestId={practiceTestId} courseSlug={slug} />
              </>
            )}
          </div>
        </div>
      </PageHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">PDF đề bài</p>
          </div>
          <iframe
            title={practiceTest.pdfName}
            src={practiceTest.pdfUrl}
            className="h-[65dvh] min-h-[420px] w-full bg-white xl:h-[640px]"
          />
        </section>

        <aside className="space-y-5">
          <AnswerKeySummary questions={practiceTest.questions} />
          <section className="border-border bg-card rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <History className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
              <p className="text-sm font-semibold">Bài làm gần đây</p>
            </div>
            <div className="divide-y">
              {allAttempts.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">Chưa có học sinh nộp bài.</p>
              ) : (
                allAttempts.slice(0, 8).map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/courses/${slug}/practice-tests/${practiceTestId}/attempt/${attempt.id}`}
                    className="hover:bg-muted/40 block px-4 py-3"
                  >
                    <p className="text-sm font-semibold">
                      {attempt.student?.fullName ??
                        `${attempt.student?.firstName ?? ''} ${attempt.student?.lastName ?? ''}`.trim() ??
                        'Học sinh'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {attempt.score ?? 0}/{attempt.maxScore ?? totalPoints(practiceTest.questions)}{' '}
                      điểm · {fmt(attempt.submittedAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      <ActivityCompetencyPanel
        courseId={course.id}
        courseSlug={slug}
        activityType="practice-test"
        activityId={practiceTestId}
        canManage={canManage}
      />

      {(prevNavItem || nextNavItem) && (
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
      )}
    </div>
  );
}

function ActivityProgress({ currentIndex, total }: { currentIndex: number; total: number }) {
  if (total <= 1 || currentIndex < 0) return null;
  return (
    <div className="bg-muted h-1 overflow-hidden rounded-full">
      <div
        className="bg-primary h-full transition-all duration-500"
        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
      />
    </div>
  );
}

function StudentBlockedView({
  slug,
  practiceTest,
  myAttempts,
  reason,
}: {
  slug: string;
  practiceTest: PracticeTestDetail;
  myAttempts: PracticeAttemptListItem[];
  reason: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/courses/${slug}/modules`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Nội dung khoá học
      </Link>
      <div className="border-border bg-card rounded-xl border p-4 shadow-sm sm:p-6">
        <FileQuestion className="mb-3 h-8 w-8 text-cyan-700 dark:text-cyan-400" />
        <h1 className="font-heading text-2xl font-bold tracking-tight break-words">
          {practiceTest.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{reason}</p>
      </div>
      {myAttempts.length > 0 && (
        <div className="border-border bg-card rounded-xl border shadow-sm">
          <div className="border-b px-4 py-3 text-sm font-semibold">Bài làm của bạn</div>
          <div className="divide-y">
            {myAttempts.map((attempt) => (
              <Link
                key={attempt.id}
                href={`/courses/${slug}/practice-tests/${practiceTest.id}/attempt/${attempt.id}`}
                className="hover:bg-muted/40 flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>{fmt(attempt.submittedAt)}</span>
                <strong>
                  {attempt.score ?? 0}/{attempt.maxScore ?? totalPoints(practiceTest.questions)}
                </strong>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerKeySummary({ questions }: { questions: PracticeTestQuestion[] }) {
  const sections = groupBySection(questions);
  return (
    <section className="border-border bg-card rounded-xl border shadow-sm">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Đáp án đã cấu hình</p>
      </div>
      <div className="max-h-[520px] space-y-4 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.type} className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold">{section.label}</p>
            {section.questions.map((question, index) => (
              <div key={question.id} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">Câu {index + 1}</span>
                  <span className="text-muted-foreground text-xs">{question.points} điểm</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{formatAnswer(question)}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatAnswer(question: PracticeTestQuestion) {
  const answer = question.correctAnswer;
  if (!answer) return 'Đáp án ẩn';
  if ('option' in answer) return `Trắc nghiệm: ${answer.option}`;
  if ('statements' in answer) {
    const key = answer.statements
      .slice(0, question.statementCount)
      .map((value, index) => `${String.fromCharCode(97 + index)}) ${value ? 'Đúng' : 'Sai'}`)
      .join(' · ');
    const scores = Array.isArray(answer.scoreByCorrectCount)
      ? answer.scoreByCorrectCount
          .slice(1, question.statementCount + 1)
          .map((score, index) => `${index + 1} đúng: ${score}`)
          .join(' · ')
      : '';
    return scores ? `${key} | ${scores}` : key;
  }
  if ('answers' in answer) return `Trả lời ngắn: ${answer.answers.join(' / ')}`;
  return 'Đáp án ẩn';
}
