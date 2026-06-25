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

// ── Clustering Dataset (xuất dữ liệu phân cụm học sinh) ─────────
// Mỗi học sinh = 1 dòng. Dùng cho nghiên cứu phân cụm (K-Means + GA…).
// Các cột điểm đã chuẩn hoá về [0,1] (chia maxScore). Cờ has_* = đã từng làm
// loại hoạt động đó (1/0) để phân biệt "chưa làm" với "0 điểm" khi tiền xử lý.

export const ClusteringColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
});
export type ClusteringColumn = z.infer<typeof ClusteringColumnSchema>;

export const ClusteringStudentRowSchema = z.object({
  // Định danh — KHÔNG đưa vào tính khoảng cách.
  studentCode: z.string(), // mã ẩn danh HS001…
  name: z.string(),
  email: z.string(),

  // A. Kết quả học tập (đã chuẩn hoá 0–1)
  quizAvg: z.number().nullable(),
  quizBest: z.number().nullable(),
  quizCount: z.number().int().nonnegative(),
  quizPassRate: z.number().nullable(),
  hasQuiz: z.number().int(), // 0/1
  assignAvg: z.number().nullable(),
  assignCount: z.number().int().nonnegative(),
  hasAssign: z.number().int(),
  codeAvg: z.number().nullable(),
  codeCount: z.number().int().nonnegative(),
  codePassRate: z.number().nullable(),
  hasCode: z.number().int(),
  practiceAvg: z.number().nullable(),
  practiceCount: z.number().int().nonnegative(),
  hasPractice: z.number().int(),
  overallScore: z.number().nullable(), // TB các điểm thành phần có sẵn
  scoreStd: z.number().nullable(), // độ lệch chuẩn các điểm thành phần

  // B. Chuyên cần & tiến độ
  progress: z.number(), // 0–1 (Enrollment.progress)
  completionRate: z.number(), // # mục đã hoàn thành / # mục đã publish
  loginCount: z.number().int().nonnegative(), // toàn hệ thống (User.loginCount)
  activeDays: z.number().int().nonnegative(), // số ngày có hoạt động trong khoá
  eventsTotal: z.number().int().nonnegative(), // tổng sự kiện trong khoá
  viewCount: z.number().int().nonnegative(),
  recencyDays: z.number().nullable(), // số ngày kể từ lần truy cập cuối

  // C. Hành vi & thói quen
  lateRate: z.number().nullable(), // tỉ lệ nộp muộn
  avgLeadTimeHours: z.number().nullable(), // TB (dueDate - submittedAt) theo giờ
  avgAttempts: z.number().nullable(), // TB số lần nộp
  nightRatio: z.number().nullable(), // tỉ lệ hoạt động 22h–5h
  submitViewRatio: z.number().nullable(), // SUBMIT_* / VIEW_*

  // D. Năng lực (CBE)
  competencyAvg: z.number().nullable(), // TB mức quy đổi 0–4
  competencyCount: z.number().int().nonnegative(),

  // E. Tương tác xã hội
  forumTopics: z.number().int().nonnegative(),
  forumPosts: z.number().int().nonnegative(),
});
export type ClusteringStudentRow = z.infer<typeof ClusteringStudentRowSchema>;

export const ClusteringDatasetSchema = z.object({
  course: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  generatedAt: z.string(), // ISO
  studentCount: z.number().int().nonnegative(),
  columns: z.array(ClusteringColumnSchema), // thứ tự cột cho bảng + CSV
  rows: z.array(ClusteringStudentRowSchema),
});
export type ClusteringDataset = z.infer<typeof ClusteringDatasetSchema>;
