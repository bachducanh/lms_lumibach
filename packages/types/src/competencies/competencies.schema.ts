import { z } from 'zod';

// ── Mức độ thành thạo năng lực ─────────────────────────────────
// Khớp enum CompetencyLevel trong schema.prisma. score dùng cho thống kê (0..4).

// Bảng màu: NO_EVIDENCE đỏ, BEGINNING cam, APPROACHING xanh lá nhạt,
// PROFICIENT xanh lá đậm, ADVANCED tím. textColor đi kèm để đảm bảo tương phản.
export const COMPETENCY_LEVELS = [
  {
    value: 'NO_EVIDENCE',
    label: 'Không có minh chứng',
    short: 'Không có MC',
    score: 0,
    color: '#dc2626', // red-600
    textColor: '#ffffff',
  },
  {
    value: 'BEGINNING',
    label: 'Chưa thành thạo',
    short: 'Chưa TT',
    score: 1,
    color: '#f97316', // orange-500
    textColor: '#ffffff',
  },
  {
    value: 'APPROACHING',
    label: 'Gần thành thạo',
    short: 'Gần TT',
    score: 2,
    color: '#86efac', // green-300 — xanh lá nhạt
    textColor: '#14532d', // green-900 cho tương phản trên nền nhạt
  },
  {
    value: 'PROFICIENT',
    label: 'Thành thạo',
    short: 'Thành thạo',
    score: 3,
    color: '#15803d', // green-700 — xanh lá đậm
    textColor: '#ffffff',
  },
  {
    value: 'ADVANCED',
    label: 'Vượt thành thạo',
    short: 'Vượt TT',
    score: 4,
    color: '#a855f7', // purple-500 — tím
    textColor: '#ffffff',
  },
] as const;

export type CompetencyLevelValue = (typeof COMPETENCY_LEVELS)[number]['value'];

export const COMPETENCY_LEVEL_VALUES = COMPETENCY_LEVELS.map((l) => l.value) as [
  CompetencyLevelValue,
  ...CompetencyLevelValue[],
];

export const COMPETENCY_LEVEL_LABEL: Record<CompetencyLevelValue, string> = Object.fromEntries(
  COMPETENCY_LEVELS.map((l) => [l.value, l.label])
) as Record<CompetencyLevelValue, string>;

export const COMPETENCY_LEVEL_SCORE: Record<CompetencyLevelValue, number> = Object.fromEntries(
  COMPETENCY_LEVELS.map((l) => [l.value, l.score])
) as Record<CompetencyLevelValue, number>;

// ── Tiến độ học-tập ─────────────────────────────────────────────
// Bucket theo tỉ lệ % chỉ báo hoàn thành tại cấp độ năng lực đích, theo Chính sách
// đánh giá H.A.S. minPercent/maxPercent là % làm tròn (số nguyên 0..100), phủ kín
// toàn bộ khoảng — tránh dùng phân số thô 0..1 vì với danh mục có nhiều chỉ báo,
// 1 chỉ báo hoàn thành có thể ra tỉ lệ < 1% (VD 1/200 = 0.5%) và lọt khe giữa 2 mốc.
export const LEARNING_PACE_LEVELS = [
  {
    value: 'NOT_RECORDED',
    label: 'Không ghi nhận được sự tiến bộ',
    minPercent: 0,
    maxPercent: 0,
    color: '#dc2626', // red-600
    textColor: '#ffffff',
  },
  {
    value: 'BEHIND',
    label: 'Chậm tiến độ',
    minPercent: 1,
    maxPercent: 50,
    color: '#f97316', // orange-500
    textColor: '#ffffff',
  },
  {
    value: 'NEARLY_ON_TRACK',
    label: 'Gần đúng tiến độ',
    minPercent: 51,
    maxPercent: 69,
    color: '#86efac', // green-300
    textColor: '#14532d',
  },
  {
    value: 'ON_TRACK',
    label: 'Đúng tiến độ',
    minPercent: 70,
    maxPercent: 90,
    color: '#15803d', // green-700
    textColor: '#ffffff',
  },
  {
    value: 'AHEAD',
    label: 'Vượt tiến độ',
    minPercent: 91,
    maxPercent: 100,
    color: '#a855f7', // purple-500
    textColor: '#ffffff',
  },
] as const;

export type LearningPaceValue = (typeof LEARNING_PACE_LEVELS)[number]['value'];

export const LEARNING_PACE_LABEL: Record<LearningPaceValue, string> = Object.fromEntries(
  LEARNING_PACE_LEVELS.map((l) => [l.value, l.label])
) as Record<LearningPaceValue, string>;

// rate: phân số 0..1 (0 hoặc không có chỉ báo nào => NOT_RECORDED). Làm tròn về %
// nguyên trước khi so khoảng, để mọi rate > 0 luôn rơi vào đúng 1 mốc (không có khe hở).
export function learningPaceFromRate(rate: number): LearningPaceValue {
  if (rate <= 0) return 'NOT_RECORDED';
  const percent = Math.round(rate * 100);
  if (percent <= 0) return 'NOT_RECORDED';
  const hit = LEARNING_PACE_LEVELS.find((l) => percent >= l.minPercent && percent <= l.maxPercent);
  return hit?.value ?? 'AHEAD';
}

// ── 22 loại minh chứng, gom theo 5 nhóm ────────────────────────

export const EVIDENCE_CATEGORIES = [
  {
    key: 'ACADEMIC',
    label: 'Minh chứng học thuật',
    types: [
      { key: 'ACADEMIC_ARGUMENT', label: 'Bài viết tranh luận' },
      { key: 'ACADEMIC_NARRATIVE', label: 'Bài viết kể chuyện' },
      { key: 'ACADEMIC_RESEARCH', label: 'Bài nghiên cứu' },
      { key: 'ACADEMIC_LAB_REPORT', label: 'Báo cáo thí nghiệm' },
      { key: 'ACADEMIC_CRITIQUE', label: 'Bài phản biện hoặc phân tích văn bản' },
      { key: 'ACADEMIC_INTERDISCIPLINARY', label: 'Bài tổng hợp kiến thức liên môn' },
    ],
  },
  {
    key: 'PERFORMANCE',
    label: 'Minh chứng thực hành',
    types: [
      { key: 'PERFORMANCE_PROJECT', label: 'Dự án học tập hoặc sản phẩm sáng tạo' },
      { key: 'PERFORMANCE_PRESENTATION', label: 'Bài thuyết trình đa phương tiện' },
      { key: 'PERFORMANCE_MODEL', label: 'Mô hình, thiết kế hoặc sản phẩm kỹ thuật' },
      { key: 'PERFORMANCE_EXPERIMENT', label: 'Hoạt động thực hành hoặc thí nghiệm mở rộng' },
      { key: 'PERFORMANCE_SIMULATION', label: 'Bài mô phỏng tình huống thực tế' },
    ],
  },
  {
    key: 'COMMUNICATION',
    label: 'Minh chứng giao tiếp và hợp tác',
    types: [
      { key: 'COMMUNICATION_VIDEO', label: 'Video thuyết trình hoặc phỏng vấn' },
      { key: 'COMMUNICATION_GROUP_LOG', label: 'Nhật ký nhóm hoặc biên bản họp nhóm' },
      { key: 'COMMUNICATION_PEER_FEEDBACK', label: 'Phản hồi đồng học (peer feedback)' },
      { key: 'COMMUNICATION_REFLECTION', label: 'Bài viết phản ánh cá nhân (reflection essay)' },
    ],
  },
  {
    key: 'PERSONAL',
    label: 'Minh chứng phát triển cá nhân',
    types: [
      { key: 'PERSONAL_JOURNAL', label: 'Nhật ký học tập' },
      { key: 'PERSONAL_PLAN', label: 'Kế hoạch học tập cá nhân' },
      { key: 'PERSONAL_SELF_ASSESSMENT', label: 'Bảng tự đánh giá năng lực' },
      { key: 'PERSONAL_PROGRESS_REPORT', label: 'Báo cáo tiến trình học tập' },
    ],
  },
  {
    key: 'EXTENDED',
    label: 'Minh chứng mở rộng',
    types: [
      { key: 'EXTENDED_COMMUNITY', label: 'Hoạt động cộng đồng hoặc dự án xã hội' },
      {
        key: 'EXTENDED_CERTIFICATE',
        label: 'Thành tích hoặc chứng nhận kỹ năng ngoài chương trình học',
      },
      { key: 'EXTENDED_CREATIVE', label: 'Sản phẩm sáng tạo cá nhân (video, tranh, ứng dụng…)' },
    ],
  },
] as const;

export type EvidenceCategoryKey = (typeof EVIDENCE_CATEGORIES)[number]['key'];

export type EvidenceTypeOption = {
  key: string;
  label: string;
  categoryKey: EvidenceCategoryKey;
  categoryLabel: string;
};

export const EVIDENCE_TYPES: EvidenceTypeOption[] = EVIDENCE_CATEGORIES.flatMap((c) =>
  c.types.map((t) => ({
    key: t.key,
    label: t.label,
    categoryKey: c.key,
    categoryLabel: c.label,
  }))
);

export const EVIDENCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  EVIDENCE_TYPES.map((t) => [t.key, t.label])
);

export const EVIDENCE_TYPE_KEYS: string[] = EVIDENCE_TYPES.map((t) => t.key);

// ── Activity type (đa hình) ────────────────────────────────────

export const ActivityTypeSchema = z.enum(['assignment', 'quiz', 'code-exercise', 'practice-test']);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const CompetencyLevelSchema = z.enum([
  'NO_EVIDENCE',
  'BEGINNING',
  'APPROACHING',
  'PROFICIENT',
  'ADVANCED',
]);

// ── Zod: Danh mục năng lực ─────────────────────────────────────

export const CreateCompetencyCategoryBodySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được trống').max(200),
  description: z.string().max(2000).optional(),
});
export type CreateCompetencyCategoryBody = z.infer<typeof CreateCompetencyCategoryBodySchema>;

export const UpdateCompetencyCategoryBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateCompetencyCategoryBody = z.infer<typeof UpdateCompetencyCategoryBodySchema>;

// ── Zod: Thành phần năng lực (giữa Danh mục và Chỉ báo) ─────────

export const CreateCompetencyComponentBodySchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1, 'Tên thành phần không được trống').max(200),
});
export type CreateCompetencyComponentBody = z.infer<typeof CreateCompetencyComponentBodySchema>;

export const UpdateCompetencyComponentBodySchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateCompetencyComponentBody = z.infer<typeof UpdateCompetencyComponentBodySchema>;

// ── Zod: Chỉ báo năng lực ──────────────────────────────────────

export const CreateCompetencyIndicatorBodySchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1, 'Nội dung chỉ báo không được trống').max(2000),
  description: z.string().max(2000).nullable().optional(),
});
export type CreateCompetencyIndicatorBody = z.infer<typeof CreateCompetencyIndicatorBodySchema>;

export const UpdateCompetencyIndicatorBodySchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(2000).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateCompetencyIndicatorBody = z.infer<typeof UpdateCompetencyIndicatorBodySchema>;

// ── Zod: Import hàng loạt từ Excel ─────────────────────────────

/**
 * Một dòng trong file Excel: chỉ báo thuộc thành phần nào, thành phần thuộc
 * danh mục nào. Danh mục/thành phần lặp lại ở nhiều dòng — server gom lại,
 * tạo danh mục/thành phần một lần rồi gắn chỉ báo vào.
 */
export const ImportCompetencyRowSchema = z.object({
  categoryName: z.string().min(1, 'Thiếu tên danh mục').max(200),
  categoryDescription: z.string().max(2000).optional(),
  componentName: z.string().min(1, 'Thiếu tên thành phần').max(200),
  componentCode: z.string().max(50).optional(),
  code: z.string().max(50).optional(),
  name: z.string().min(1, 'Thiếu nội dung chỉ báo').max(2000),
  description: z.string().max(2000).optional(),
});
export type ImportCompetencyRow = z.infer<typeof ImportCompetencyRowSchema>;

export const ImportCompetenciesBodySchema = z.object({
  rows: z.array(ImportCompetencyRowSchema).min(1, 'File không có dòng nào').max(2000),
});
export type ImportCompetenciesBody = z.infer<typeof ImportCompetenciesBodySchema>;

export type ImportCompetenciesResult = {
  categoriesCreated: number;
  categoriesReused: number;
  componentsCreated: number;
  componentsReused: number;
  indicatorsCreated: number;
  /** Chỉ báo bỏ qua vì đã có sẵn trong thành phần (trùng mã hoặc trùng nội dung). */
  indicatorsSkipped: number;
  /** Dòng không hợp lệ — số dòng tính theo file Excel (đã tính cả dòng tiêu đề). */
  errors: { row: number; reason: string }[];
};

// ── Zod: Gán chỉ báo cho hoạt động ─────────────────────────────

export const SetActivityCompetenciesBodySchema = z.object({
  activityType: ActivityTypeSchema,
  activityId: z.string().min(1),
  indicatorIds: z.array(z.string().min(1)).max(100),
});
export type SetActivityCompetenciesBody = z.infer<typeof SetActivityCompetenciesBodySchema>;

// ── Zod: Chấm năng lực (upsert) ────────────────────────────────

export const UpsertCompetencyAssessmentBodySchema = z.object({
  activityType: ActivityTypeSchema,
  activityId: z.string().min(1),
  indicatorId: z.string().min(1),
  studentId: z.string().min(1),
  level: CompetencyLevelSchema,
  evidenceType: z.string().max(50).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type UpsertCompetencyAssessmentBody = z.infer<typeof UpsertCompetencyAssessmentBodySchema>;

export const ActivityCompetencyQuerySchema = z.object({
  activityType: ActivityTypeSchema,
  activityId: z.string().min(1),
});
export type ActivityCompetencyQuery = z.infer<typeof ActivityCompetencyQuerySchema>;

// ── Zod: Kỳ đánh giá năng lực (học kỳ) ──────────────────────────

export const CreateCompetencyPeriodBodySchema = z.object({
  name: z.string().min(1, 'Tên kỳ đánh giá không được trống').max(200),
  position: z.number().int().min(0).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});
export type CreateCompetencyPeriodBody = z.infer<typeof CreateCompetencyPeriodBodySchema>;

export const UpdateCompetencyPeriodBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  position: z.number().int().min(0).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});
export type UpdateCompetencyPeriodBody = z.infer<typeof UpdateCompetencyPeriodBodySchema>;

// ── Zod: Cấp độ năng lực xuất phát/đích (upsert) ────────────────

const CompetencyLevelValueSchema = z.number().int().min(1).max(12);

export const UpsertCompetencyLevelTargetBodySchema = z.object({
  periodId: z.string().min(1),
  componentId: z.string().min(1),
  studentId: z.string().min(1),
  startLevel: CompetencyLevelValueSchema,
  targetLevel: CompetencyLevelValueSchema,
});
export type UpsertCompetencyLevelTargetBody = z.infer<typeof UpsertCompetencyLevelTargetBodySchema>;

// ── Zod: Rubric 5 mức cho 1 cặp (chỉ báo, hoạt động) ────────────
// Cùng 1 chỉ báo có thể được đánh giá bằng rubric khác nhau tuỳ hoạt động/bài
// cụ thể, nên rubric gắn theo cặp (indicatorId, activityId) chứ không cố định
// trên chỉ báo.

export const CompetencyRubricTextSchema = z.object({
  noEvidence: z.string().max(4000).nullable().optional(),
  beginning: z.string().max(4000).nullable().optional(),
  approaching: z.string().max(4000).nullable().optional(),
  proficient: z.string().max(4000).nullable().optional(),
  advanced: z.string().max(4000).nullable().optional(),
});
export type CompetencyRubricText = {
  noEvidence: string | null;
  beginning: string | null;
  approaching: string | null;
  proficient: string | null;
  advanced: string | null;
};

export const UpsertActivityCompetencyRubricBodySchema = z.object({
  activityType: ActivityTypeSchema,
  activityId: z.string().min(1),
  indicatorId: z.string().min(1),
  rubric: CompetencyRubricTextSchema,
});
export type UpsertActivityCompetencyRubricBody = z.infer<
  typeof UpsertActivityCompetencyRubricBodySchema
>;

// ── Response types ─────────────────────────────────────────────

export type CompetencyIndicatorItem = {
  id: string;
  componentId: string;
  code: string | null;
  name: string;
  description: string | null;
  position: number;
};

export type CompetencyComponentItem = {
  id: string;
  categoryId: string;
  code: string | null;
  name: string;
  position: number;
  indicators: CompetencyIndicatorItem[];
};

export type CompetencyCategoryItem = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  position: number;
  components: CompetencyComponentItem[];
};

export type CourseCompetencyCatalog = {
  categories: CompetencyCategoryItem[];
};

export type CompetencyAssessmentItem = {
  id: string;
  indicatorId: string;
  studentId: string;
  level: CompetencyLevelValue;
  evidenceType: string | null;
  note: string | null;
  gradedBy: string;
  gradedAt: string;
};

// Chỉ báo trong ngữ cảnh 1 hoạt động cụ thể — kèm rubric riêng của cặp
// (chỉ báo, hoạt động) này (có thể toàn null nếu GV chưa nhập).
export type ActivityCompetencyIndicatorItem = CompetencyIndicatorItem & {
  rubric: CompetencyRubricText;
};

// Trạng thái năng lực của 1 hoạt động: chỉ báo đã gán (kèm rubric riêng) +
// các đánh giá đã chấm.
export type ActivityCompetencyState = {
  indicators: ActivityCompetencyIndicatorItem[];
  assessments: CompetencyAssessmentItem[];
};

// ── Thống kê ───────────────────────────────────────────────────

export type CompetencyIndicatorStat = {
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string | null;
  categoryId: string;
  categoryName: string;
  totalAssessments: number; // tổng số lượt chấm (minh chứng) ghi nhận cho chỉ báo này
  studentsAssessedCount: number; // số học sinh có ít nhất 1 minh chứng
  studentsCompletedCount: number; // số học sinh "hoàn thành" chỉ báo (≥2 minh chứng Thành thạo/Vượt thành thạo)
  averageScore: number | null; // 0..4
  levelCounts: Record<CompetencyLevelValue, number>;
};

export type CompetencyStudentStat = {
  studentId: string;
  studentName: string;
  email: string;
  totalAssessments: number;
  indicatorsAssessedCount: number; // số chỉ báo có ít nhất 1 minh chứng
  indicatorsCompletedCount: number; // số chỉ báo "hoàn thành" (≥2 minh chứng Thành thạo/Vượt thành thạo)
  averageScore: number | null;
  levelCounts: Record<CompetencyLevelValue, number>;
};

export type CompetencyCategoryStat = {
  categoryId: string;
  categoryName: string;
  totalAssessments: number;
  averageScore: number | null;
};

export type EvidenceTypeStat = {
  evidenceType: string;
  label: string;
  count: number;
};

export type CompetencyStats = {
  totalIndicators: number;
  totalStudents: number;
  totalAssessments: number;
  indicators: CompetencyIndicatorStat[];
  students: CompetencyStudentStat[];
  categories: CompetencyCategoryStat[];
  evidenceTypes: EvidenceTypeStat[];
};

// ── Điểm năng lực theo kỳ đánh giá ───────────────────────────────

export type CompetencyPeriod = {
  id: string;
  courseId: string;
  name: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
};

// Điểm năng lực của 1 học sinh, tại 1 thành phần năng lực, trong 1 kỳ đánh
// giá — theo công thức Chính sách đánh giá H.A.S, tính ở CẤP THÀNH PHẦN.
// startLevel/targetLevel null nếu GV chưa nhập cấp độ (đây là nơi GV nhập).
export type CompetencyComponentLevelRow = {
  studentId: string;
  studentName: string;
  componentId: string;
  componentName: string;
  categoryId: string;
  categoryName: string;
  startLevel: number | null;
  targetLevel: number | null;
  completedIndicators: number;
  totalIndicators: number;
  completionRate: number | null; // phân số 0..1, null nếu totalIndicators = 0
  competencyScore: number | null; // startLevel + 2 × completionRate
  growthScore: number | null; // competencyScore − startLevel
  learningPace: LearningPaceValue | null;
};

// Điểm năng lực của 1 học sinh, gộp lên cấp DANH MỤC — tính lại từ các dòng
// thành phần (CompetencyComponentLevelRow) cùng danh mục: startLevel/
// targetLevel/competencyScore = trung bình cộng các thành phần; completionRate
// = tổng chỉ báo hoàn thành / tổng chỉ báo toàn danh mục (gộp phẳng, không
// phải trung bình cộng tỉ lệ). Đây là dòng CHỈ ĐỌC — không nhập trực tiếp.
export type CompetencyCategoryLevelRow = {
  studentId: string;
  studentName: string;
  categoryId: string;
  categoryName: string;
  startLevel: number | null;
  targetLevel: number | null;
  completedIndicators: number;
  totalIndicators: number;
  completionRate: number | null;
  competencyScore: number | null;
  growthScore: number | null;
  learningPace: LearningPaceValue | null;
};

export type CompetencyPeriodGrid = {
  period: CompetencyPeriod;
  categories: { id: string; name: string }[];
  components: { id: string; categoryId: string; name: string }[];
  componentRows: CompetencyComponentLevelRow[];
  categoryRollups: CompetencyCategoryLevelRow[];
};

// Một dòng minh chứng năng lực cho hồ sơ học tập cá nhân (Phase 3 dùng lại).
export type CompetencyEvidenceRow = {
  assessmentId: string;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  categoryName: string;
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string | null;
  level: CompetencyLevelValue;
  evidenceType: string | null;
  note: string | null;
  gradedAt: string;
  moduleId: string | null;
  moduleName: string | null;
  // Đường dẫn (không có /courses/SLUG) tới trang xem bài làm cụ thể của học sinh.
  // Frontend prepend /courses/${slug}. Có thể null nếu HS chưa có bài nộp/lần làm.
  viewerPath: string | null;
};

// ── Xuất Excel "Tổng hợp kết quả" (giống cấu trúc file mẫu H.A.S) ───────
// Phạm vi 1 lần xuất = 1 kỳ đánh giá × 1 danh mục năng lực, giống file mẫu
// (1 sheet tổng hợp + 1 sheet/học sinh, mỗi sheet liệt kê từng minh chứng).

export type CompetencyExportEvidence = {
  activityTitle: string;
  level: CompetencyLevelValue;
  gradedAt: string;
  rubric: CompetencyRubricText;
};

export type CompetencyExportIndicator = {
  indicatorId: string;
  code: string | null;
  name: string;
  completed: boolean;
  evidences: CompetencyExportEvidence[];
};

export type CompetencyExportComponent = {
  componentId: string;
  code: string | null;
  name: string;
  startLevel: number | null;
  targetLevel: number | null;
  indicators: CompetencyExportIndicator[];
  completedCount: number;
  totalCount: number;
  rate: number | null;
  score: number | null;
  growth: number | null;
};

export type CompetencyExportStudent = {
  studentId: string;
  studentCode: string;
  fullName: string;
  components: CompetencyExportComponent[];
  categoryStart: number | null;
  categoryTarget: number | null;
  categoryRate: number | null;
  categoryScore: number | null;
  categoryGrowth: number | null;
  learningPace: LearningPaceValue | null;
};

export type CompetencyExportData = {
  category: { id: string; name: string };
  period: { id: string; name: string };
  students: CompetencyExportStudent[];
};
