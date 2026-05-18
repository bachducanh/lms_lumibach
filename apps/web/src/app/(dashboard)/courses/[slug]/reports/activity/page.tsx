import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import type { CourseDetail } from '@lumibach/types';

export const metadata = { title: 'Báo cáo hoạt động - Khóa học' };
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  LESSON: 'Bài giảng',
  ASSIGNMENT: 'Bài tập',
  QUIZ: 'Quiz',
  CODE_EXERCISE: 'Bài code',
  EXTERNAL_URL: 'Link ngoài',
  FILE: 'File',
};

const TYPE_BADGE: Record<string, string> = {
  LESSON: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  ASSIGNMENT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  QUIZ: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  CODE_EXERCISE: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  EXTERNAL_URL: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  FILE: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
};

const VIEW_ACTIONS = ['VIEW_LESSON', 'VIEW_ASSIGNMENT', 'VIEW_EXERCISE', 'START_QUIZ'] as const;

export default async function ActivityReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  const [modules, enrollCount] = await Promise.all([
    prisma.module.findMany({
      where: { courseId: course.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            lessonId: true,
            assignmentId: true,
            quizId: true,
            codeExerciseId: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where: { courseId: course.id, status: 'ACTIVE' } }),
  ]);

  const resourceIds = [
    ...new Set(
      modules.flatMap((m) =>
        m.items
          .map((it) => it.lessonId ?? it.assignmentId ?? it.quizId ?? it.codeExerciseId)
          .filter((value): value is string => Boolean(value))
      )
    ),
  ];

  const [viewLogs, uniqueViewers, assignmentSubmissions, quizAttempts, codeSubmissions] =
    await Promise.all([
      resourceIds.length > 0
        ? prisma.activityLog.groupBy({
            by: ['resourceId'],
            where: {
              courseId: course.id,
              resourceId: { in: resourceIds },
              action: { in: [...VIEW_ACTIONS] },
            },
            _count: { _all: true },
          })
        : [],
      resourceIds.length > 0
        ? prisma.activityLog.findMany({
            where: {
              courseId: course.id,
              resourceId: { in: resourceIds },
              action: { in: [...VIEW_ACTIONS] },
            },
            distinct: ['resourceId', 'userId'],
            select: { resourceId: true, userId: true },
          })
        : [],
      prisma.submission.groupBy({
        by: ['assignmentId'],
        where: { assignment: { courseId: course.id }, submittedAt: { not: null } },
        _count: { _all: true },
      }),
      prisma.quizAttempt.groupBy({
        by: ['quizId'],
        where: { quiz: { courseId: course.id } },
        _count: { _all: true },
      }),
      prisma.codeSubmission.groupBy({
        by: ['codeExerciseId'],
        where: { codeExercise: { courseId: course.id } },
        _count: { _all: true },
      }),
    ]);

  const viewsByResource = new Map(viewLogs.map((row) => [row.resourceId!, row._count._all]));
  const uniqueByResource = new Map<string, number>();
  for (const viewer of uniqueViewers) {
    if (!viewer.resourceId) continue;
    uniqueByResource.set(viewer.resourceId, (uniqueByResource.get(viewer.resourceId) ?? 0) + 1);
  }

  const submissionsByAssignment = new Map(
    assignmentSubmissions.map((row) => [row.assignmentId, row._count._all])
  );
  const attemptsByQuiz = new Map(quizAttempts.map((row) => [row.quizId, row._count._all]));
  const submissionsByCode = new Map(
    codeSubmissions.map((row) => [row.codeExerciseId, row._count._all])
  );

  const totalItems = modules.reduce((sum, module) => sum + module.items.length, 0);

  return (
    <div className="space-y-5">
      <div className="text-muted-foreground text-xs">
        {totalItems} mục · {enrollCount} học viên · tổng lượt xem và lượt tương tác của lớp
      </div>

      <div className="space-y-6">
        {modules.length === 0 && (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Khóa học chưa có chương nào.
          </p>
        )}

        {modules.map((module) => (
          <div key={module.id} className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="border-border bg-muted/30 border-b px-4 py-2.5">
              <h3 className="text-sm font-semibold">{module.name}</h3>
              <p className="text-muted-foreground text-[11px]">{module.items.length} mục</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-muted-foreground border-border bg-muted/20 border-b text-left text-xs">
                  <tr>
                    <Th>Loại</Th>
                    <Th>Tài liệu / bài kiểm tra</Th>
                    <Th align="right">Lượt xem</Th>
                    <Th align="right">Học viên đã xem</Th>
                    <Th align="right">Lượt tương tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {module.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-muted-foreground p-6 text-center text-xs italic"
                      >
                        Chương rỗng.
                      </td>
                    </tr>
                  )}

                  {module.items.map((item) => {
                    const resourceId =
                      item.lessonId ?? item.assignmentId ?? item.quizId ?? item.codeExerciseId;
                    const views = resourceId ? (viewsByResource.get(resourceId) ?? 0) : 0;
                    const unique = resourceId ? (uniqueByResource.get(resourceId) ?? 0) : 0;
                    const interactions = getInteractions(item, {
                      submissionsByAssignment,
                      attemptsByQuiz,
                      submissionsByCode,
                    });
                    const percent = enrollCount > 0 ? Math.round((unique / enrollCount) * 100) : 0;

                    return (
                      <tr key={item.id} className="border-border/40 hover:bg-muted/20 border-b">
                        <td className="px-3 py-2 align-top">
                          <Badge
                            variant="outline"
                            className={`${TYPE_BADGE[item.type] ?? ''} border-transparent text-[10px]`}
                          >
                            {TYPE_LABEL[item.type] ?? item.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium">{item.title}</p>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <span className="font-mono tabular-nums">{views}</span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <span className="font-mono tabular-nums">
                            {unique} / {enrollCount}
                          </span>
                          <span className="text-muted-foreground ml-1 text-[10px]">
                            ({percent}%)
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {interactions === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="font-mono tabular-nums">{interactions}</span>
                          )}
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
    </div>
  );
}

function getInteractions(
  item: {
    type: string;
    assignmentId: string | null;
    quizId: string | null;
    codeExerciseId: string | null;
  },
  maps: {
    submissionsByAssignment: Map<string, number>;
    attemptsByQuiz: Map<string, number>;
    submissionsByCode: Map<string, number>;
  }
) {
  if (item.type === 'ASSIGNMENT' && item.assignmentId) {
    return maps.submissionsByAssignment.get(item.assignmentId) ?? 0;
  }
  if (item.type === 'QUIZ' && item.quizId) {
    return maps.attemptsByQuiz.get(item.quizId) ?? 0;
  }
  if (item.type === 'CODE_EXERCISE' && item.codeExerciseId) {
    return maps.submissionsByCode.get(item.codeExerciseId) ?? 0;
  }
  return null;
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-3 py-2.5 font-semibold tracking-wide uppercase ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
