import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import type { CourseDetail, PracticeAttemptListItem, PracticeTestDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { FileQuestion } from 'lucide-react';
import { PracticeAttemptsTable } from '@/components/features/practice-tests/PracticeAttemptsTable';

export const metadata = { title: 'Bài làm đề luyện tập' };

export default async function PracticeAttemptsPage({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string }>;
}) {
  const { slug, practiceTestId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !session?.user?.id) redirect('/login');

  const api = apiServerClient(await cookies());
  const [course, practiceTest] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<PracticeTestDetail>(`/practice-tests/${practiceTestId}`).catch(() => null),
  ]);
  if (!course || !practiceTest) notFound();
  if (!hasMinRole(role, 'TA')) redirect(`/courses/${slug}/practice-tests/${practiceTestId}`);

  const attempts = await api
    .get<PracticeAttemptListItem[]>(`/practice-tests/${practiceTestId}/attempts`)
    .catch(() => [] as PracticeAttemptListItem[]);

  const maxScore =
    attempts.find((a) => a.maxScore != null)?.maxScore ??
    practiceTest.questions.reduce((s, q) => s + q.points, 0);
  const submitted = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  const graded = attempts.filter((a) => a.status === 'GRADED');
  const avgScore =
    graded.length > 0 ? graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <FileQuestion className="h-4 w-4 shrink-0 text-cyan-500" />
        <Link
          href={`/courses/${slug}/practice-tests/${practiceTestId}`}
          className="hover:text-foreground max-w-60 truncate transition-colors"
        >
          {practiceTest.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium">Bài làm</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{practiceTest.title}</h1>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>{attempts.length} lượt làm</span>
          <span>·</span>
          <span>{submitted.length} đã nộp</span>
          {avgScore != null && (
            <>
              <span>·</span>
              <span>
                Điểm TB:{' '}
                <span className="text-foreground font-semibold">
                  {avgScore.toFixed(2)}/{maxScore}
                </span>
              </span>
              <span>·</span>
              <span>
                Hệ 10:{' '}
                <span className="text-foreground font-semibold">
                  {maxScore > 0 ? ((avgScore / maxScore) * 10).toFixed(2) : '—'}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      <PracticeAttemptsTable
        attempts={attempts}
        questions={practiceTest.questions}
        practiceTestId={practiceTestId}
        practiceTestTitle={practiceTest.title}
        courseSlug={slug}
      />
    </div>
  );
}
