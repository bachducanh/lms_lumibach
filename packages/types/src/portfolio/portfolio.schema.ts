import { z } from 'zod';
import type { ActivityType, CompetencyEvidenceRow } from '../competencies/competencies.schema';

// ── Reflection (tự đánh giá) ───────────────────────────────────

export const CreateReflectionBodySchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được trống').max(200),
  content: z.string().min(1, 'Nội dung không được trống').max(5000),
});
export type CreateReflectionBody = z.infer<typeof CreateReflectionBodySchema>;

export const UpdateReflectionBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
});
export type UpdateReflectionBody = z.infer<typeof UpdateReflectionBodySchema>;

// ── Response types ─────────────────────────────────────────────

export type PortfolioGradedItem = {
  id: string; // submission/attempt id
  activityType: ActivityType;
  activityId: string;
  title: string;
  score: number | null;
  maxScore: number | null;
  status: string;
  feedback: string | null;
  date: string | null; // submitted/graded date
};

export type PortfolioReflectionItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioStudent = {
  id: string;
  name: string;
  email: string;
};

export type PortfolioSummary = {
  totalGraded: number;
  averagePercent: number | null;
  competencyCount: number;
  reflectionCount: number;
};

export type PortfolioData = {
  student: PortfolioStudent;
  canEdit: boolean; // true nếu người xem chính là học sinh đó
  summary: PortfolioSummary;
  gradedItems: PortfolioGradedItem[];
  competencyEvidence: CompetencyEvidenceRow[];
  reflections: PortfolioReflectionItem[];
};
