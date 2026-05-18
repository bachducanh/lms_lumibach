import { z } from 'zod';

/**
 * Zod schemas + types cho analytics module.
 *
 * Lưu ý: thực tế controller TRẢ về object plain JS, nên các schema này chủ yếu
 * để dùng làm TYPE share giữa FE/BE. Không validate response trên BE (output
 * có thể trust). FE có thể parse() nếu cần defensive — nhưng cost cao cho
 * payload lớn. Để dạng schema/type-only.
 */

export const DailySeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});
export type DailySeriesPoint = z.infer<typeof DailySeriesPointSchema>;

// ── Admin Overview ────────────────────────────────────────────

export const AdminOverviewSchema = z.object({
  totals: z.object({
    users: z.number().int().nonnegative(),
    activeUsers7: z.number().int().nonnegative(),
    courses: z.number().int().nonnegative(),
    quizAttempts: z.number().int().nonnegative(),
    submissions: z.number().int().nonnegative(),
    codeSubmissions: z.number().int().nonnegative(),
  }),
  byRole: z.array(z.object({ role: z.string(), count: z.number().int().nonnegative() })),
  dailyActivity30: z.array(DailySeriesPointSchema),
  dailyActiveUsers30: z.array(DailySeriesPointSchema),
  dailySubmissions30: z.array(DailySeriesPointSchema),
  topCourses: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      activity: z.number().int().nonnegative(),
      enrolled: z.number().int().nonnegative(),
    })
  ),
  topStudents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      activity: z.number().int().nonnegative(),
    })
  ),
  actionBreakdown: z.array(z.object({ action: z.string(), count: z.number().int().nonnegative() })),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

// ── Course Analytics ──────────────────────────────────────────

export const CourseAnalyticsSchema = z.object({
  course: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  totals: z.object({
    enrolled: z.number().int().nonnegative(),
    activeStudents7: z.number().int().nonnegative(),
    quizAttempts: z.number().int().nonnegative(),
    assignmentSubmits: z.number().int().nonnegative(),
    codeSubmits: z.number().int().nonnegative(),
    avgQuizPercent: z.number().nullable(),
    avgAssignmentScore: z.number().nullable(),
    codePassRate: z.number().nullable(),
  }),
  dailyActivity30: z.array(DailySeriesPointSchema),
  quizScoreDist: z.array(z.object({ bucket: z.string(), count: z.number().int().nonnegative() })),
  topStudents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      activity: z.number().int().nonnegative(),
      avgQuiz: z.number().nullable(),
    })
  ),
  inactiveStudents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      // ISO datetime string khi qua HTTP (BE Date → JSON.stringify).
      lastSeenAt: z.string().nullable(),
    })
  ),
  perAssignment: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      submissionRate: z.number(),
      avgScore: z.number().nullable(),
      lateCount: z.number().int().nonnegative(),
    })
  ),
  perQuiz: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      completionRate: z.number(),
      avgPercent: z.number().nullable(),
      attempts: z.number().int().nonnegative(),
    })
  ),
  perExercise: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      studentsAttempted: z.number().int().nonnegative(),
      passRate: z.number(),
    })
  ),
});
export type CourseAnalytics = z.infer<typeof CourseAnalyticsSchema>;
