import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type { AdminOverview, CourseAnalytics, DailySeriesPoint } from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const CACHE_TTL_MS = 300_000; // 5 phút — analytics tốn nhiều query, cache aggressive

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  // ── Admin Overview ────────────────────────────────────────────

  async getAdminOverview(): Promise<AdminOverview> {
    return this.cached('analytics:admin-overview', () => this.queryAdminOverview());
  }

  private async queryAdminOverview(): Promise<AdminOverview> {
    const now7 = new Date();
    now7.setDate(now7.getDate() - 7);
    const now30 = new Date();
    now30.setDate(now30.getDate() - 30);

    const [
      totalUsers,
      activeUsers7Rows,
      totalCourses,
      totalQuizAttempts,
      totalSubmissions,
      totalCodeSubmissions,
      byRoleRaw,
      dailyActivityRaw,
      dailyActiveUsersRaw,
      dailySubmissionsRawA,
      dailySubmissionsRawC,
      topCoursesRaw,
      topStudentsRaw,
      actionBreakdownRaw,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.activityLog.findMany({
        where: { createdAt: { gte: now7 } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.quizAttempt.count(),
      this.prisma.submission.count({ where: { submittedAt: { not: null } } }),
      this.prisma.codeSubmission.count(),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char("createdAt"::date, 'YYYY-MM-DD') AS date, COUNT(*)::bigint AS count
        FROM "ActivityLog"
        WHERE "createdAt" >= ${now30}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char("createdAt"::date, 'YYYY-MM-DD') AS date, COUNT(DISTINCT "userId")::bigint AS count
        FROM "ActivityLog"
        WHERE "createdAt" >= ${now30}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char("submittedAt"::date, 'YYYY-MM-DD') AS date, COUNT(*)::bigint AS count
        FROM "Submission"
        WHERE "submittedAt" >= ${now30}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char("submittedAt"::date, 'YYYY-MM-DD') AS date, COUNT(*)::bigint AS count
        FROM "CodeSubmission"
        WHERE "submittedAt" >= ${now30}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<
        { id: string; name: string; slug: string; activity: bigint; enrolled: bigint }[]
      >`
        SELECT c.id, c.name, c.slug,
          (SELECT COUNT(*) FROM "ActivityLog" a WHERE a."courseId" = c.id AND a."createdAt" >= ${now30})::bigint AS activity,
          (SELECT COUNT(*) FROM "Enrollment" e WHERE e."courseId" = c.id AND e.status = 'ACTIVE')::bigint AS enrolled
        FROM "Course" c
        WHERE c."deletedAt" IS NULL
        ORDER BY activity DESC
        LIMIT 5
      `,
      this.prisma.$queryRaw<{ id: string; name: string; activity: bigint }[]>`
        SELECT u.id,
          COALESCE(u."fullName", u."firstName" || ' ' || u."lastName") AS name,
          COUNT(a.id)::bigint AS activity
        FROM "User" u
        JOIN "ActivityLog" a ON a."userId" = u.id
        WHERE a."createdAt" >= ${now30} AND u.role = 'STUDENT'
        GROUP BY u.id
        ORDER BY activity DESC
        LIMIT 8
      `,
      this.prisma.activityLog.groupBy({
        by: ['action'],
        _count: true,
        where: { createdAt: { gte: now30 } },
        orderBy: { _count: { action: 'desc' } },
      }),
    ]);

    const submissionsMap = new Map<string, number>();
    for (const r of dailySubmissionsRawA) submissionsMap.set(r.date, Number(r.count));
    for (const r of dailySubmissionsRawC) {
      submissionsMap.set(r.date, (submissionsMap.get(r.date) ?? 0) + Number(r.count));
    }
    const dailySubmissions = Array.from(submissionsMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totals: {
        users: totalUsers,
        activeUsers7: activeUsers7Rows.length,
        courses: totalCourses,
        quizAttempts: totalQuizAttempts,
        submissions: totalSubmissions,
        codeSubmissions: totalCodeSubmissions,
      },
      byRole: byRoleRaw.map((r) => ({ role: r.role, count: r._count })),
      dailyActivity30: this.fillSeries(
        dailyActivityRaw.map((r) => ({ date: r.date, count: Number(r.count) })),
        30
      ),
      dailyActiveUsers30: this.fillSeries(
        dailyActiveUsersRaw.map((r) => ({ date: r.date, count: Number(r.count) })),
        30
      ),
      dailySubmissions30: this.fillSeries(dailySubmissions, 30),
      topCourses: topCoursesRaw.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        activity: Number(c.activity),
        enrolled: Number(c.enrolled),
      })),
      topStudents: topStudentsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        activity: Number(s.activity),
      })),
      actionBreakdown: actionBreakdownRaw.map((r) => ({ action: r.action, count: r._count })),
    };
  }

  // ── Course Analytics ──────────────────────────────────────────

  async getCourseAnalytics(user: AuthUser, courseSlug: string): Promise<CourseAnalytics> {
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true, name: true, slug: true, ownerId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (user.role === 'TEACHER' && course.ownerId !== user.id) {
      throw new NotFoundException('Course not found');
    }

    return this.cached(`analytics:course:${course.id}`, () => this.queryCourseAnalytics(course));
  }

  private async queryCourseAnalytics(course: {
    id: string;
    name: string;
    slug: string;
  }): Promise<CourseAnalytics> {
    const courseId = course.id;
    const now7 = new Date();
    now7.setDate(now7.getDate() - 7);
    const now30 = new Date();
    now30.setDate(now30.getDate() - 30);

    const [
      enrolledStudents,
      activeStudents7,
      quizAttempts,
      assignmentSubmits,
      codeSubmits,
      quizAttemptStats,
      assignmentStats,
      codeStats,
      dailyActivityRaw,
      quizScoreDistRaw,
      topStudentsRaw,
      inactiveRaw,
      perAssignmentRaw,
      perQuizRaw,
      perExerciseRaw,
    ] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE', user: { role: 'STUDENT' } },
        select: { userId: true },
      }),
      this.prisma.activityLog.findMany({
        where: { courseId, createdAt: { gte: now7 }, user: { role: 'STUDENT' } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.quizAttempt.count({ where: { quiz: { courseId } } }),
      this.prisma.submission.count({
        where: { assignment: { courseId }, submittedAt: { not: null } },
      }),
      this.prisma.codeSubmission.count({ where: { codeExercise: { courseId } } }),
      this.prisma.quizAttempt.findMany({
        where: {
          quiz: { courseId },
          status: 'SUBMITTED',
          score: { not: null },
          maxScore: { not: null },
        },
        select: { score: true, maxScore: true },
      }),
      this.prisma.submission.aggregate({
        where: { assignment: { courseId }, score: { not: null } },
        _avg: { score: true },
      }),
      this.prisma.codeSubmission.findMany({
        where: { codeExercise: { courseId }, score: { not: null }, maxScore: { not: null } },
        select: { score: true, maxScore: true },
      }),
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT to_char("createdAt"::date, 'YYYY-MM-DD') AS date, COUNT(*)::bigint AS count
        FROM "ActivityLog"
        WHERE "courseId" = ${courseId} AND "createdAt" >= ${now30}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
        SELECT
          CASE
            WHEN qa.score / NULLIF(qa."maxScore",0) < 0.2 THEN '0-20'
            WHEN qa.score / NULLIF(qa."maxScore",0) < 0.4 THEN '20-40'
            WHEN qa.score / NULLIF(qa."maxScore",0) < 0.6 THEN '40-60'
            WHEN qa.score / NULLIF(qa."maxScore",0) < 0.8 THEN '60-80'
            ELSE '80-100'
          END AS bucket,
          COUNT(*)::bigint AS count
        FROM "QuizAttempt" qa
        JOIN "Quiz" q ON q.id = qa."quizId"
        WHERE q."courseId" = ${courseId} AND qa.status = 'SUBMITTED'
          AND qa.score IS NOT NULL AND qa."maxScore" IS NOT NULL AND qa."maxScore" > 0
        GROUP BY 1
      `,
      this.prisma.$queryRaw<{ id: string; name: string; activity: bigint; avg: number | null }[]>`
        SELECT u.id,
          COALESCE(u."fullName", u."firstName" || ' ' || u."lastName") AS name,
          COUNT(a.id)::bigint AS activity,
          (
            SELECT AVG(qa.score / NULLIF(qa."maxScore",0)) * 100
            FROM "QuizAttempt" qa
            JOIN "Quiz" q ON q.id = qa."quizId"
            WHERE qa."studentId" = u.id AND q."courseId" = ${courseId}
              AND qa.status = 'SUBMITTED' AND qa."maxScore" > 0
          ) AS avg
        FROM "User" u
        JOIN "Enrollment" e ON e."userId" = u.id AND e."courseId" = ${courseId}
        LEFT JOIN "ActivityLog" a
          ON a."userId" = u.id AND a."courseId" = ${courseId} AND a."createdAt" >= ${now30}
        WHERE u.role = 'STUDENT' AND e.status = 'ACTIVE'
        GROUP BY u.id
        ORDER BY activity DESC NULLS LAST
        LIMIT 10
      `,
      this.prisma.$queryRaw<{ id: string; name: string; lastSeenAt: Date | null }[]>`
        SELECT u.id,
          COALESCE(u."fullName", u."firstName" || ' ' || u."lastName") AS name,
          (SELECT MAX(a."createdAt") FROM "ActivityLog" a WHERE a."userId" = u.id AND a."courseId" = ${courseId}) AS "lastSeenAt"
        FROM "User" u
        JOIN "Enrollment" e ON e."userId" = u.id AND e."courseId" = ${courseId}
        WHERE u.role = 'STUDENT' AND e.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM "ActivityLog" a
            WHERE a."userId" = u.id AND a."courseId" = ${courseId} AND a."createdAt" >= ${now7}
          )
        ORDER BY "lastSeenAt" DESC NULLS LAST
        LIMIT 15
      `,
      this.prisma.$queryRaw<
        {
          id: string;
          title: string;
          submitted: bigint;
          avg: number | null;
          late: bigint;
        }[]
      >`
        SELECT a.id, a.title,
          COUNT(s.id) FILTER (WHERE s."submittedAt" IS NOT NULL)::bigint AS submitted,
          AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS avg,
          COUNT(s.id) FILTER (WHERE s."submittedAt" IS NOT NULL AND a."dueDate" IS NOT NULL AND s."submittedAt" > a."dueDate")::bigint AS late
        FROM "Assignment" a
        LEFT JOIN "Submission" s ON s."assignmentId" = a.id
        WHERE a."courseId" = ${courseId} AND a."deletedAt" IS NULL
        GROUP BY a.id, a.title
        ORDER BY a."createdAt" DESC
      `,
      this.prisma.$queryRaw<
        {
          id: string;
          title: string;
          attempts: bigint;
          submitted: bigint;
          avg: number | null;
        }[]
      >`
        SELECT q.id, q.title,
          COUNT(qa.id)::bigint AS attempts,
          COUNT(qa.id) FILTER (WHERE qa.status = 'SUBMITTED')::bigint AS submitted,
          AVG(qa.score / NULLIF(qa."maxScore",0)) FILTER (WHERE qa.status = 'SUBMITTED' AND qa."maxScore" > 0) * 100 AS avg
        FROM "Quiz" q
        LEFT JOIN "QuizAttempt" qa ON qa."quizId" = q.id
        WHERE q."courseId" = ${courseId} AND q."deletedAt" IS NULL
        GROUP BY q.id, q.title
        ORDER BY q."createdAt" DESC
      `,
      this.prisma.$queryRaw<
        {
          id: string;
          title: string;
          students: bigint;
          passers: bigint;
        }[]
      >`
        SELECT ce.id, ce.title,
          COUNT(DISTINCT cs."studentId")::bigint AS students,
          COUNT(DISTINCT CASE
            WHEN cs."maxScore" > 0 AND cs.score = cs."maxScore" THEN cs."studentId"
          END)::bigint AS passers
        FROM "CodeExercise" ce
        LEFT JOIN "CodeSubmission" cs ON cs."codeExerciseId" = ce.id
        WHERE ce."courseId" = ${courseId} AND ce."deletedAt" IS NULL
        GROUP BY ce.id, ce.title
        ORDER BY ce."createdAt" DESC
      `,
    ]);

    const enrolled = enrolledStudents.length;

    let avgQuizPercent: number | null = null;
    if (quizAttemptStats.length > 0) {
      const valid = quizAttemptStats.filter((qa) => (qa.maxScore ?? 0) > 0 && qa.score !== null);
      if (valid.length > 0) {
        avgQuizPercent =
          valid.reduce((acc, qa) => acc + (qa.score! / qa.maxScore!) * 100, 0) / valid.length;
      }
    }

    let codePassRate: number | null = null;
    if (codeStats.length > 0) {
      const fullScored = codeStats.filter((c) => c.maxScore && c.score === c.maxScore).length;
      codePassRate = (fullScored / codeStats.length) * 100;
    }

    const buckets = ['0-20', '20-40', '40-60', '60-80', '80-100'];
    const bucketMap = new Map(quizScoreDistRaw.map((r) => [r.bucket, Number(r.count)]));
    const quizScoreDist = buckets.map((b) => ({ bucket: b, count: bucketMap.get(b) ?? 0 }));

    return {
      course: { id: course.id, name: course.name, slug: course.slug },
      totals: {
        enrolled,
        activeStudents7: activeStudents7.length,
        quizAttempts,
        assignmentSubmits,
        codeSubmits,
        avgQuizPercent,
        avgAssignmentScore: assignmentStats._avg.score ?? null,
        codePassRate,
      },
      dailyActivity30: this.fillSeries(
        dailyActivityRaw.map((r) => ({ date: r.date, count: Number(r.count) })),
        30
      ),
      quizScoreDist,
      topStudents: topStudentsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        activity: Number(s.activity),
        avgQuiz: s.avg !== null ? Number(s.avg) : null,
      })),
      inactiveStudents: inactiveRaw.map((r) => ({
        id: r.id,
        name: r.name,
        lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
      })),
      perAssignment: perAssignmentRaw.map((a) => ({
        id: a.id,
        title: a.title,
        submissionRate: enrolled > 0 ? (Number(a.submitted) / enrolled) * 100 : 0,
        avgScore: a.avg !== null ? Number(a.avg) : null,
        lateCount: Number(a.late),
      })),
      perQuiz: perQuizRaw.map((q) => ({
        id: q.id,
        title: q.title,
        completionRate: enrolled > 0 ? (Number(q.submitted) / enrolled) * 100 : 0,
        avgPercent: q.avg !== null ? Number(q.avg) : null,
        attempts: Number(q.attempts),
      })),
      perExercise: perExerciseRaw.map((e) => ({
        id: e.id,
        title: e.title,
        studentsAttempted: Number(e.students),
        passRate: Number(e.students) > 0 ? (Number(e.passers) / Number(e.students)) * 100 : 0,
      })),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private emptyDailySeries(days: number): DailySeriesPoint[] {
    const out: DailySeriesPoint[] = [];
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - i);
      out.push({ date: this.dayKey(d), value: 0 });
    }
    return out;
  }

  private fillSeries(rows: { date: string; count: number }[], days: number): DailySeriesPoint[] {
    const map = new Map(rows.map((r) => [r.date, r.count]));
    return this.emptyDailySeries(days).map((p) => ({ date: p.date, value: map.get(p.date) ?? 0 }));
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'test') return factory();
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, CACHE_TTL_MS);
    return fresh;
  }

  // ── Live: who is online + recent actions ───────────────────────
  // Defines "online" as: has an ActivityLog (or LOGIN audit) in the last 5
  // minutes. We don't cache because the whole point is real-time.

  async getLiveSummary(actor: AuthUser, courseId?: string) {
    const WINDOW_MIN = 5;
    const since = new Date(Date.now() - WINDOW_MIN * 60_000);

    // Course-scoped (Teacher/TA can only see their own courses).
    // Admin can pass any courseId or omit to see global.
    if (courseId && actor.role !== 'ADMIN') {
      const allowed = await this.prisma.course.findFirst({
        where: {
          id: courseId,
          deletedAt: null,
          OR: [
            { ownerId: actor.id },
            { coTeachers: { some: { userId: actor.id } } },
            { teachingAssistants: { some: { userId: actor.id } } },
          ],
        },
        select: { id: true },
      });
      if (!allowed) {
        return { onlineUsers: [], recentActions: [], windowMinutes: WINDOW_MIN };
      }
    }
    if (!courseId && actor.role !== 'ADMIN') {
      // Non-admin without a courseId can't see global feed.
      return { onlineUsers: [], recentActions: [], windowMinutes: WINDOW_MIN };
    }

    // Most recent activity per user in the window — gives lastActiveAt
    const recent = await this.prisma.activityLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        userId: true,
        action: true,
        resourceType: true,
        resourceName: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { fullName: true, email: true, role: true } },
        course: { select: { name: true } },
      },
    });

    // Group by user → keep newest createdAt per user
    const lastByUser = new Map<
      string,
      {
        id: string;
        fullName: string | null;
        email: string;
        role: string;
        lastActiveAt: Date;
      }
    >();
    for (const row of recent) {
      const existing = lastByUser.get(row.userId);
      if (!existing || existing.lastActiveAt < row.createdAt) {
        lastByUser.set(row.userId, {
          id: row.userId,
          fullName: row.user.fullName,
          email: row.user.email,
          role: row.user.role,
          lastActiveAt: row.createdAt,
        });
      }
    }

    const onlineUsers = [...lastByUser.values()]
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        lastActiveAt: u.lastActiveAt.toISOString(),
      }));

    const recentActions = recent.slice(0, 30).map((r) => ({
      id: r.id,
      userName: r.user.fullName ?? r.user.email,
      userEmail: r.user.email,
      userRole: r.user.role,
      action: r.action,
      resourceType: r.resourceType,
      resourceName: r.resourceName,
      courseName: r.course?.name ?? null,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));

    return { onlineUsers, recentActions, windowMinutes: WINDOW_MIN };
  }
}
