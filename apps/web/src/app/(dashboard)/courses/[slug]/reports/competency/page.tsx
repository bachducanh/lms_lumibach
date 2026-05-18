import { cookies } from 'next/headers';
import { Target } from 'lucide-react';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import type { CourseDetail } from '@lumibach/types';

export const metadata = { title: 'Phân tích năng lực - Khóa học' };
export const dynamic = 'force-dynamic';

const ACHIEVED_THRESHOLD = 70;

export default async function CompetencyReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  const [students, rubrics] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: course.id, status: 'ACTIVE', user: { role: 'STUDENT' } },
      select: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }, { user: { email: 'asc' } }],
    }),
    prisma.rubric.findMany({
      where: {
        OR: [
          { assignment: { courseId: course.id, deletedAt: null } },
          { codeExercise: { courseId: course.id, deletedAt: null } },
        ],
      },
      include: {
        assignment: { select: { title: true } },
        codeExercise: { select: { title: true } },
        criteria: {
          orderBy: { position: 'asc' },
          include: {
            levels: {
              orderBy: { position: 'asc' },
              select: { id: true, label: true, points: true },
            },
            grades: {
              include: {
                level: { select: { label: true, points: true } },
                submission: { select: { studentId: true } },
                codeSubmission: { select: { studentId: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const competencies = rubrics.flatMap((rubric) => {
    const assessmentTitle = rubric.assignment?.title ?? rubric.codeExercise?.title ?? 'Đánh giá';
    const assessmentType = rubric.assignment ? 'Assignment' : 'Code exercise';

    return rubric.criteria.map((criterion) => {
      const maxPoints = Math.max(...criterion.levels.map((level) => level.points), 0);
      const graded = criterion.grades
        .map((grade) => {
          const studentId = grade.submission?.studentId ?? grade.codeSubmission?.studentId;
          if (!studentId || maxPoints <= 0) return null;
          return {
            studentId,
            percent: (grade.level.points / maxPoints) * 100,
            label: grade.level.label,
          };
        })
        .filter((grade): grade is { studentId: string; percent: number; label: string } =>
          Boolean(grade)
        );
      const achieved = graded.filter((grade) => grade.percent >= ACHIEVED_THRESHOLD);
      const average =
        graded.length > 0
          ? graded.reduce((sum, grade) => sum + grade.percent, 0) / graded.length
          : null;

      return {
        id: criterion.id,
        name: criterion.name,
        description: criterion.description,
        assessmentTitle,
        assessmentType,
        maxPoints,
        gradedCount: graded.length,
        achievedCount: new Set(achieved.map((grade) => grade.studentId)).size,
        average,
        gradesByStudent: new Map(graded.map((grade) => [grade.studentId, grade])),
      };
    });
  });

  const studentRows = students.map(({ user }) => {
    const gradedCompetencies = competencies
      .map((competency) => competency.gradesByStudent.get(user.id))
      .filter((grade): grade is { studentId: string; percent: number; label: string } =>
        Boolean(grade)
      );
    const achieved = gradedCompetencies.filter((grade) => grade.percent >= ACHIEVED_THRESHOLD);
    const average =
      gradedCompetencies.length > 0
        ? gradedCompetencies.reduce((sum, grade) => sum + grade.percent, 0) /
          gradedCompetencies.length
        : null;

    return {
      id: user.id,
      name: displayUserName(user),
      email: user.email,
      gradedCount: gradedCompetencies.length,
      achievedCount: achieved.length,
      average,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Năng lực" value={String(competencies.length)} />
        <SummaryCard label="Học viên" value={String(students.length)} />
        <SummaryCard label="Ngưỡng đạt" value={`${ACHIEVED_THRESHOLD}%`} tone="text-emerald-500" />
      </div>

      {competencies.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border py-14 text-center">
          <Target className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <p className="font-medium">Chưa có rubric criteria để phân tích năng lực.</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            Khi bài tập hoặc bài code có rubric, từng tiêu chí rubric sẽ được tổng hợp tại đây.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Competency breakdown</h2>
            <div className="border-border bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-border bg-muted/30 border-b text-left text-xs">
                  <tr>
                    <Th>Năng lực / kỹ năng</Th>
                    <Th>Đánh giá</Th>
                    <Th align="right">Đã chấm</Th>
                    <Th align="right">Đạt</Th>
                    <Th align="right">Trung bình</Th>
                  </tr>
                </thead>
                <tbody>
                  {competencies.map((competency) => {
                    const achievedPercent =
                      students.length > 0
                        ? Math.round((competency.achievedCount / students.length) * 100)
                        : 0;
                    return (
                      <tr
                        key={competency.id}
                        className="border-border/50 hover:bg-muted/20 border-b"
                      >
                        <Td>
                          <p className="font-medium">{competency.name}</p>
                          {competency.description && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {competency.description}
                            </p>
                          )}
                        </Td>
                        <Td>
                          <Badge variant="outline" className="mb-1">
                            {competency.assessmentType}
                          </Badge>
                          <p className="text-muted-foreground text-xs">
                            {competency.assessmentTitle}
                          </p>
                        </Td>
                        <Td align="right">{competency.gradedCount}</Td>
                        <Td align="right">
                          {competency.achievedCount} / {students.length}
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({achievedPercent}%)
                          </span>
                        </Td>
                        <Td align="right">{formatPercent(competency.average)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Học viên theo năng lực</h2>
            <div className="border-border bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-border bg-muted/30 border-b text-left text-xs">
                  <tr>
                    <Th>Học viên</Th>
                    <Th>Email</Th>
                    <Th align="right">Năng lực đã chấm</Th>
                    <Th align="right">Năng lực đạt</Th>
                    <Th align="right">Trung bình</Th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((student) => (
                    <tr key={student.id} className="border-border/50 hover:bg-muted/20 border-b">
                      <Td>
                        <p className="font-medium">{student.name}</p>
                      </Td>
                      <Td>
                        <span className="text-muted-foreground">{student.email}</span>
                      </Td>
                      <Td align="right">{student.gradedCount}</Td>
                      <Td align="right">
                        {student.achievedCount} / {student.gradedCount || competencies.length}
                      </Td>
                      <Td align="right">{formatPercent(student.average)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'text-primary',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border-border bg-card rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value === null ? '-' : `${Math.round(value)}%`;
}

function displayUserName(user: {
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
}) {
  return (user.fullName ?? `${user.firstName} ${user.lastName}`.trim()) || user.email;
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`text-muted-foreground px-3 py-2.5 font-semibold whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-3 py-2.5 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
