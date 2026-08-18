import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type {
  CourseDetail,
  QuizDetail,
  AttemptDetailRow,
  QuizQuestionBrief,
  CourseMembersResponse,
} from '@lumibach/types';
import { hasMinRole } from '@/lib/permissions';
import { AttemptsTable } from '@/components/features/quiz/AttemptsTable';
import { Brain } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Bài làm' };

export default async function AttemptsPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}/quizzes/${quizId}`);

  const quiz = await api.get<QuizDetail>(`/quizzes/${quizId}`).catch(() => null);
  if (!quiz) notFound();

  const [{ attempts, questions }, membersData] = await Promise.all([
    api.get<{ attempts: AttemptDetailRow[]; questions: QuizQuestionBrief[] }>(
      '/attempts/detailed',
      {
        query: { quizId },
      }
    ),
    // Cả lớp, để còn biết ai CHƯA làm — thứ mà bảng lượt làm không bao giờ nói
    // ra được, vì học sinh chưa làm thì không có dòng nào.
    api
      .get<CourseMembersResponse>(`/courses/${course.id}/members`)
      .catch(() => ({ enrollments: [], tas: [], coTeachers: [] }) as CourseMembersResponse),
  ]);

  const hocSinh = membersData.enrollments
    .filter((e) => e.status === 'ACTIVE')
    .map((e) => e.user)
    .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi'));

  const daCoLuot = new Set(attempts.map((a) => a.student?.id).filter(Boolean) as string[]);
  const chuaLam = hocSinh.filter((u) => !daCoLuot.has(u.id));

  const submitted = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  const graded = attempts.filter((a) => a.status === 'GRADED');
  const avgScore =
    graded.length > 0 ? graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length : null;
  const maxScore = attempts.find((a) => a.maxScore != null)?.maxScore ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Brain className="h-4 w-4 shrink-0 text-violet-500" />
        <Link href={`/courses/${slug}/quizzes`} className="hover:text-foreground transition-colors">
          Quiz
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className="hover:text-foreground max-w-40 truncate transition-colors"
        >
          {quiz.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium">Bài làm</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
            <span>{attempts.length} lượt làm</span>
            <span>·</span>
            <span>{submitted.length} đã nộp</span>
            {hocSinh.length > 0 && (
              <>
                <span>·</span>
                <span className={chuaLam.length > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                  {chuaLam.length} chưa làm
                </span>
              </>
            )}
            {avgScore != null && maxScore != null && (
              <>
                <span>·</span>
                <span>
                  Điểm TB:{' '}
                  <span className="text-foreground font-semibold">
                    {avgScore.toFixed(2)}/{maxScore}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <AttemptsTable
        attempts={attempts}
        chuaLam={chuaLam}
        questions={questions}
        quizId={quizId}
        quizTitle={quiz.title}
        courseSlug={slug}
      />
    </div>
  );
}
