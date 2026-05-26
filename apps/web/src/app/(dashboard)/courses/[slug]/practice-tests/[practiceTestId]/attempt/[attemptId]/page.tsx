import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { groupBySection } from '@/lib/practice-test-utils';
import type { CourseDetail, PracticeAttemptDetail, PracticeTestQuestion } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, CheckCircle2, FileQuestion, Users, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Kết quả đề luyện tập' };

function fmt(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string; attemptId: string }>;
}) {
  const { slug, practiceTestId, attemptId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !session?.user?.id) redirect('/login');

  const api = apiServerClient(await cookies());
  const [course, attempt] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<PracticeAttemptDetail>(`/practice-tests/attempts/${attemptId}`).catch(() => null),
  ]);
  if (!course || !attempt) notFound();
  if (attempt.practiceTestId !== practiceTestId) notFound();
  if (attempt.practiceTest.courseId !== course.id) notFound();

  const isStaff = hasMinRole(role, 'TA');
  const questions = attempt.practiceTest.questions;
  const sections = groupBySection(questions);
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? questions.reduce((s, q) => s + q.points, 0);
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const score10 = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 100 : 0;
  const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
  const answersVisible = questions.some((q) => q.correctAnswer != null);
  const answerMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const studentName =
    attempt.student?.fullName ??
    `${attempt.student?.firstName ?? ''} ${attempt.student?.lastName ?? ''}`.trim();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="bg-muted/20 border-border -mx-6 -mt-6 mb-6 flex flex-wrap items-center gap-2 border-b px-6 py-4">
        <FileQuestion className="h-4 w-4 text-cyan-500" />
        <Link
          href={`/courses/${slug}/practice-tests/${practiceTestId}`}
          className="text-muted-foreground hover:text-foreground truncate text-sm transition-colors"
        >
          {attempt.practiceTest.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">Kết quả</span>
        {isStaff && (
          <Link
            href={`/courses/${slug}/practice-tests/${practiceTestId}/attempts`}
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <Users className="h-4 w-4" /> Tất cả bài làm
          </Link>
        )}
      </div>

      {/* Score card */}
      <div className="border-primary/20 bg-primary/5 rounded-2xl border-2 p-8 text-center">
        {isStaff && studentName && (
          <p className="text-muted-foreground mb-2 text-sm">
            Bài làm của <span className="text-foreground font-semibold">{studentName}</span>
            {attempt.student?.email ? ` · ${attempt.student.email}` : ''}
          </p>
        )}
        <div className="text-foreground text-6xl font-bold">
          {score}
          <span className="text-muted-foreground text-2xl">/{maxScore}</span>
        </div>
        <p className="text-muted-foreground mt-1 text-2xl font-semibold">{pct}%</p>
        <p className="text-muted-foreground mt-2 text-sm">Nộp lúc {fmt(attempt.submittedAt)}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Điểm hệ 10
          </p>
          <p className="text-primary mt-1 text-lg font-bold">{score10.toFixed(2)}</p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Câu đúng hoàn toàn
          </p>
          <p className="mt-1 text-lg font-bold">
            {correctCount}
            <span className="text-muted-foreground text-sm">/{questions.length}</span>
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Điểm thô
          </p>
          <p className="mt-1 text-lg font-bold">
            {score}
            <span className="text-muted-foreground text-sm">/{maxScore}</span>
          </p>
        </div>
      </div>

      {/* Per-question table grouped by section */}
      <div className="space-y-5">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Chi tiết theo câu
        </h2>
        {sections.map((section) => (
          <div key={section.type} className="space-y-2">
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              {section.label}
            </p>
            <div className="border-border overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="w-14 px-3 py-2 text-left font-semibold">Câu</th>
                    <th className="px-3 py-2 text-left font-semibold">Bạn trả lời</th>
                    {answersVisible && (
                      <th className="px-3 py-2 text-left font-semibold">Đáp án</th>
                    )}
                    <th className="w-24 px-3 py-2 text-right font-semibold">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {section.questions.map((question, index) => {
                    const answer = answerMap.get(question.id);
                    const earned = answer?.score ?? 0;
                    const full = earned >= question.points && question.points > 0;
                    return (
                      <tr key={question.id} className="align-top">
                        <td className="px-3 py-2 font-semibold">{index + 1}</td>
                        <td className="text-muted-foreground px-3 py-2">
                          {formatStudentAnswer(question, answer)}
                        </td>
                        {answersVisible && (
                          <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                            {question.correctAnswer ? formatCorrectAnswer(question) : '—'}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums',
                              full
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : earned > 0
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'border-destructive/30 bg-destructive/10 text-destructive'
                            )}
                          >
                            {full ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {earned}/{question.points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* PDF reference */}
      <details className="border-border bg-card group overflow-hidden rounded-xl border" open>
        <summary className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold">
          <FileQuestion className="h-4 w-4 text-cyan-500" />
          Đề bài PDF
        </summary>
        <iframe
          title={attempt.practiceTest.pdfName}
          src={attempt.practiceTest.pdfUrl}
          className="h-[640px] w-full bg-white"
        />
      </details>

      <div className="border-border flex items-center gap-4 border-t pt-4">
        <Link
          href={`/courses/${slug}/practice-tests/${practiceTestId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Về đề luyện tập
        </Link>
      </div>
    </div>
  );
}

function formatStudentAnswer(
  question: PracticeTestQuestion,
  answer: PracticeAttemptDetail['answers'][number] | undefined
) {
  if (!answer) return 'Chưa trả lời';
  if (question.type === 'MULTIPLE_CHOICE') return answer.selectedOption || 'Chưa chọn';
  if (question.type === 'TRUE_FALSE_MULTI') {
    const values = answer.statementAnswers ?? [];
    return values
      .slice(0, question.statementCount)
      .map(
        (value, index) =>
          `${String.fromCharCode(97 + index)}) ${value === null ? '-' : value ? 'Đúng' : 'Sai'}`
      )
      .join(' · ');
  }
  return answer.textAnswer || 'Chưa trả lời';
}

function formatCorrectAnswer(question: PracticeTestQuestion) {
  const answer = question.correctAnswer;
  if (!answer) return 'Ẩn';
  if ('option' in answer) return answer.option;
  if ('statements' in answer) {
    return answer.statements
      .slice(0, question.statementCount)
      .map((value, index) => `${String.fromCharCode(97 + index)}) ${value ? 'Đúng' : 'Sai'}`)
      .join(' · ');
  }
  if ('answers' in answer) return answer.answers.join(' / ');
  return 'Ẩn';
}
