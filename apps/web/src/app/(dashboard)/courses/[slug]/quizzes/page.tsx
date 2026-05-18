import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, QuizzesByModule, QuizListItem } from '@lumibach/types';
import { hasMinRole } from '@/lib/permissions';
import { Brain, Clock, CheckCircle2, BookOpen, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Quiz' };

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CLOSED: 'bg-destructive/10 text-destructive',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  CLOSED: 'Đã đóng',
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

function QuizCard({ quiz, slug, isStaff }: { quiz: QuizListItem; slug: string; isStaff: boolean }) {
  const due = formatDate(quiz.dueDate);
  const isOverdue = quiz.dueDate && new Date() > new Date(quiz.dueDate);

  return (
    <Link
      href={`/courses/${slug}/quizzes/${quiz.id}`}
      className="border-border bg-card hover:bg-accent/40 flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
        <Brain className="h-5 w-5 text-violet-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{quiz.title}</p>
          {isStaff && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_CLASS[quiz.status]
              )}
            >
              {STATUS_LABEL[quiz.status]}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {quiz._count.questions} câu hỏi
          </span>
          {quiz.timeLimit && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {quiz.timeLimit} phút
              </span>
            </>
          )}
          {due && (
            <>
              <span>·</span>
              <span
                className={cn(isOverdue && quiz.status === 'PUBLISHED' ? 'text-destructive' : '')}
              >
                Hạn: {due}
              </span>
            </>
          )}
          {isStaff && (
            <>
              <span>·</span>
              <span>{quiz._count.attempts} lượt làm</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function QuizzesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role) redirect('/login');

  const isStaff = hasMinRole(role, 'TA');
  const { groups, standalone } = await api.get<QuizzesByModule>('/quizzes', {
    query: { courseId: course.id },
  });
  const total = groups.reduce((s, g) => s + g.quizzes.length, 0) + standalone.length;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-violet-500" />
          <span>{course.name}</span>
        </div>
        <h1 className="text-2xl font-bold">Quiz</h1>
        {total > 0 && (
          <p className="text-muted-foreground mt-0.5 text-sm">
            {total} quiz trong {groups.length} chương
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <Brain className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground font-medium">Chưa có quiz nào</p>
          {isStaff && (
            <p className="text-muted-foreground/60 text-xs">
              Thêm quiz qua mục "Thêm hoạt động và tài nguyên" trong từng chương.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quizzes grouped by module */}
          {groups.map((group) => (
            <div key={group.moduleId} className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg border border-violet-500/10 bg-violet-500/5 px-4 py-2.5">
                <BookOpen className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  {group.moduleName}
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {group.quizzes.length} quiz
                </span>
              </div>
              {group.quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} slug={slug} isStaff={isStaff} />
              ))}
            </div>
          ))}

          {/* Standalone quizzes — chỉ staff thấy */}
          {isStaff && standalone.length > 0 && (
            <div className="space-y-2">
              <div className="bg-muted/40 border-border flex items-center gap-2.5 rounded-lg border px-4 py-2.5">
                <FolderOpen className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground text-sm font-semibold">
                  Chưa thuộc chương nào
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {standalone.length} quiz
                </span>
              </div>
              {standalone.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} slug={slug} isStaff={isStaff} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
