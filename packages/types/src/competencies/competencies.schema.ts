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

// ── Response types ─────────────────────────────────────────────

export type CompetencyIndicatorItem = {
  id: string;
  categoryId: string;
  code: string | null;
  name: string;
  description: string | null;
  position: number;
};

export type CompetencyCategoryItem = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  position: number;
  indicators: CompetencyIndicatorItem[];
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

// Trạng thái năng lực của 1 hoạt động: chỉ báo đã gán + các đánh giá đã chấm.
export type ActivityCompetencyState = {
  indicators: CompetencyIndicatorItem[];
  assessments: CompetencyAssessmentItem[];
};

// ── Thống kê ───────────────────────────────────────────────────

export type CompetencyIndicatorStat = {
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string | null;
  categoryId: string;
  categoryName: string;
  totalAssessments: number;
  achievedCount: number; // số đánh giá đạt mức Thành thạo trở lên
  averageScore: number | null; // 0..4
  levelCounts: Record<CompetencyLevelValue, number>;
};

export type CompetencyStudentStat = {
  studentId: string;
  studentName: string;
  email: string;
  totalAssessments: number;
  achievedCount: number;
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
};
