import type { PracticeQuestionType, PracticeTestQuestion } from '@lumibach/types';

export const PT_SECTION_LABEL: Record<PracticeQuestionType, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm',
  TRUE_FALSE_MULTI: 'Đúng/Sai nhiều phát biểu',
  SHORT_ANSWER: 'Trả lời ngắn',
};

export const PT_SECTION_ORDER: PracticeQuestionType[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE_MULTI',
  'SHORT_ANSWER',
];

/**
 * Số thứ tự câu hỏi đếm lại từ 1 trong từng phần (trắc nghiệm, đúng/sai,
 * trả lời ngắn) — khớp với phiếu trả lời học sinh thấy khi làm bài.
 */
export function numberBySection(
  questions: { id: string; type: PracticeQuestionType }[]
): Map<string, number> {
  const counters: Partial<Record<PracticeQuestionType, number>> = {};
  const map = new Map<string, number>();
  for (const q of questions) {
    counters[q.type] = (counters[q.type] ?? 0) + 1;
    map.set(q.id, counters[q.type]!);
  }
  return map;
}

/** Nhóm câu hỏi theo phần, giữ thứ tự TN → Đúng/Sai → Trả lời ngắn. */
export function groupBySection<T extends PracticeTestQuestion>(questions: T[]) {
  return PT_SECTION_ORDER.map((type) => ({
    type,
    label: PT_SECTION_LABEL[type],
    questions: questions.filter((q) => q.type === type),
  })).filter((section) => section.questions.length > 0);
}
