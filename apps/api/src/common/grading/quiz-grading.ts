import { PrismaClient, type Prisma } from '@lumibach/db';

// Logic chấm tự động cho các loại câu hỏi dựa trên QuestionOption.
// Dùng chung giữa lúc học sinh nộp bài (AttemptsService.submit) và lúc giáo viên
// sửa lại đề/đáp án (QuestionsService.update → regradeQuizzesForQuestion), để hai
// đường đi luôn cho ra cùng một kết quả.

export type GradableOption = {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
};

export type StoredAnswer = {
  selectedOptionIds: string | null;
  booleanAnswer: boolean | null;
  textAnswer: string | null;
} | null;

export type AutoGradeResult = { isCorrect: boolean; score: number };

/** Câu hỏi giáo viên phải chấm tay — không tự động tính lại điểm được. */
export const MANUAL_QUESTION_TYPES = ['ESSAY', 'CODE_WEB'] as const;

/** Câu hỏi chấm bằng Judge0 — chấm lại sẽ giữ nguyên điểm cũ (xem ghi chú bên dưới). */
export const CODE_AUTO_QUESTION_TYPES = [
  'CODE_PYTHON',
  'CODE_CPP',
  'CODE_DEBUG_PYTHON',
  'CODE_DEBUG_CPP',
] as const;

export function isManualQuestionType(type: string): boolean {
  return (MANUAL_QUESTION_TYPES as readonly string[]).includes(type);
}

export function isCodeAutoQuestionType(type: string): boolean {
  return (CODE_AUTO_QUESTION_TYPES as readonly string[]).includes(type);
}

function parseJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonRecord(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Vế phải của một cặp ghép nối. `content` là JSON `{ left, right }`; nội dung
 * hỏng thì trả chuỗi rỗng để cặp đó không bao giờ được tính đúng.
 */
function matchingRightText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { right?: unknown };
    return typeof parsed.right === 'string' ? parsed.right.trim() : '';
  } catch {
    return '';
  }
}

/** Bỏ dấu tiếng Việt + hạ chữ thường, để so nhãn không phụ thuộc cách gõ. */
function normalizeLabel(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').trim().toLowerCase();
}

const TRUE_LABELS = new Set(['dung', 'true', 'yes', 'y', 't', 'co', 'x']);
const FALSE_LABELS = new Set(['sai', 'false', 'no', 'n', 'f', 'khong']);

/**
 * Đáp án của câu Đúng/Sai: `true` nghĩa là "Đúng", `null` nghĩa là đề chưa đánh
 * dấu đáp án nào.
 *
 * Trước đây so thẳng `content === 'Đúng'`, nên chỉ cần nhãn khác đi một chút —
 * câu nhập từ nguồn khác ghi "True", hay dư một khoảng trắng — là mọi bài chọn
 * "Đúng" đều bị 0 điểm mà không ai biết. Giờ so theo nhãn đã chuẩn hoá, và nếu
 * vẫn không nhận ra thì dựa vào vị trí: ô đầu tiên luôn là "Đúng".
 */
function trueFalseCorrectValue(options: GradableOption[]): boolean | null {
  const correct = options.find((o) => o.isCorrect);
  if (!correct) return null;

  const label = normalizeLabel(correct.content);
  if (TRUE_LABELS.has(label)) return true;
  if (FALSE_LABELS.has(label)) return false;

  const sorted = [...options].sort((a, b) => a.position - b.position);
  return sorted[0]?.id === correct.id;
}

function ratioScore(correct: number, total: number, points: number): number {
  return total > 0 ? Math.round((correct / total) * points * 10) / 10 : 0;
}

/**
 * Chấm các loại câu hỏi dựa trên option. Trả về `null` với câu tự luận / code
 * (những loại cần chấm tay hoặc cần chạy Judge0).
 */
export function gradeOptionAnswer(
  type: string,
  options: GradableOption[],
  points: number,
  answer: StoredAnswer
): AutoGradeResult | null {
  if (isManualQuestionType(type) || isCodeAutoQuestionType(type)) return null;

  if (type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE') {
    const correctIds = options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();
    const selectedIds = parseJsonArray<string>(answer?.selectedOptionIds, []).sort();
    const isCorrect =
      correctIds.length > 0 &&
      correctIds.length === selectedIds.length &&
      correctIds.every((id, i) => id === selectedIds[i]);
    return { isCorrect, score: isCorrect ? points : 0 };
  }

  if (type === 'TRUE_FALSE') {
    const correctIsDong = trueFalseCorrectValue(options);
    // Chưa trả lời, hoặc đề không xác định được đáp án → không cho điểm.
    if (correctIsDong === null || answer?.booleanAnswer == null) {
      return { isCorrect: false, score: 0 };
    }
    const isCorrect = answer.booleanAnswer === correctIsDong;
    return { isCorrect, score: isCorrect ? points : 0 };
  }

  if (type === 'TRUE_FALSE_MULTI') {
    // Bỏ trắng KHÁC "chọn Sai cho tất cả". Học sinh bấm Sai thì client vẫn lưu
    // một dòng Answer với mảng rỗng; không đụng vào câu thì không có dòng nào.
    // Không phân biệt hai ca này thì bỏ trắng vẫn ăn điểm mọi ý đáp án là Sai.
    if (!answer || answer.selectedOptionIds === null) {
      return { isCorrect: false, score: 0 };
    }
    const studentDong = new Set(parseJsonArray<string>(answer.selectedOptionIds, []));
    let correct = 0;
    for (const opt of options) {
      if (studentDong.has(opt.id) === opt.isCorrect) correct++;
    }
    return {
      isCorrect: options.length > 0 && correct === options.length,
      score: ratioScore(correct, options.length, points),
    };
  }

  if (type === 'PARSONS' || type === 'ORDERING') {
    const studentIds = parseJsonArray<string>(answer?.textAnswer, []);
    const sorted = [...options].sort((a, b) => a.position - b.position);
    let correct = 0;
    for (let idx = 0; idx < sorted.length; idx++) {
      if (studentIds[idx] === sorted[idx]!.id) correct++;
    }
    return {
      isCorrect: sorted.length > 0 && correct === sorted.length,
      score: ratioScore(correct, sorted.length, points),
    };
  }

  if (type === 'MATCHING') {
    // textAnswer = JSON map { leftOptionId: rightOptionId }. Mỗi option giữ một cặp
    // left/right trong `content`.
    //
    // So sánh theo NỘI DUNG vế phải chứ không theo id option. Giáo viên rất hay
    // đặt trùng vế phải cho nhiều vế trái (nhiều mục cùng đáp án). Cột phải chỉ
    // hiện chữ, nên hai thẻ trùng chữ là không phân biệt được — học sinh ghép
    // đúng nghĩa nhưng bốc trúng thẻ của option kia thì id lệch và bị 0 điểm.
    const map = parseJsonRecord(answer?.textAnswer);
    const rightTextById = new Map(options.map((o) => [o.id, matchingRightText(o.content)]));

    let correct = 0;
    for (const opt of options) {
      const chosenId = map[opt.id];
      if (!chosenId) continue;
      const expected = rightTextById.get(opt.id) ?? '';
      const chosen = rightTextById.get(chosenId) ?? '';
      if (expected !== '' && chosen === expected) correct++;
    }
    return {
      isCorrect: options.length > 0 && correct === options.length,
      score: ratioScore(correct, options.length, points),
    };
  }

  if (type === 'CODE_FILL') {
    const studentFills = parseJsonArray<string>(answer?.textAnswer, []);
    const sorted = [...options].sort((a, b) => a.position - b.position);
    let correct = 0;
    for (let idx = 0; idx < sorted.length; idx++) {
      if ((studentFills[idx] ?? '').trim() === sorted[idx]!.content.trim()) correct++;
    }
    return {
      isCorrect: sorted.length > 0 && correct === sorted.length,
      score: ratioScore(correct, sorted.length, points),
    };
  }

  return { isCorrect: false, score: 0 };
}

/**
 * Chấm lại toàn bộ bài đã nộp của một quiz theo đề/đáp án hiện tại.
 *
 * Câu tự luận và câu code (Judge0) giữ nguyên điểm đã có: điểm tự luận là do giáo
 * viên chấm tay, còn chạy lại Judge0 cho mọi bài làm vừa chậm vừa dễ quá tải.
 *
 * Trả về số bài làm được chấm lại.
 */
export async function regradeQuizAttempts(prisma: PrismaClient, quizId: string): Promise<number> {
  const quizQuestions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { position: 'asc' },
    include: { question: { include: { options: { orderBy: { position: 'asc' } } } } },
  });
  if (quizQuestions.length === 0) return 0;

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId, status: { in: ['SUBMITTED', 'GRADED'] } },
    select: { id: true, answers: true },
  });
  if (attempts.length === 0) return 0;

  const maxScore = quizQuestions.reduce((sum, qq) => sum + (qq.points ?? qq.question.points), 0);

  for (const attempt of attempts) {
    const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let totalScore = 0;
    let needsManualGrading = false;

    for (const qq of quizQuestions) {
      const points = qq.points ?? qq.question.points;
      const stored = answerMap.get(qq.questionId) ?? null;
      const type = qq.question.type as string;

      if (isManualQuestionType(type) || isCodeAutoQuestionType(type)) {
        if (stored?.score != null) totalScore += stored.score;
        // Chưa có điểm: câu tự luận thì chờ giáo viên chấm, còn câu code thì
        // điểm null nghĩa là lúc nộp Judge0 không gọi được. Cả hai đều phải giữ
        // bài ở trạng thái chờ — chấm lại mà đóng bài luôn thì lần sập dịch vụ
        // đó biến thành 0 điểm vĩnh viễn.
        else needsManualGrading = true;
        continue;
      }

      const graded = gradeOptionAnswer(type, qq.question.options, points, stored);
      if (!graded) continue;
      totalScore += graded.score;

      // Bỏ qua câu vừa được thêm vào quiz sau khi học sinh đã nộp: không có bài
      // làm để chấm, chỉ tính 0 điểm vào tổng.
      if (!stored) continue;
      if (stored.isCorrect === graded.isCorrect && stored.score === graded.score) continue;

      ops.push(
        prisma.answer.update({
          where: { id: stored.id },
          data: { isCorrect: graded.isCorrect, score: graded.score },
        })
      );
    }

    ops.push(
      prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score: Math.round(totalScore * 100) / 100,
          maxScore,
          status: needsManualGrading ? 'SUBMITTED' : 'GRADED',
        },
      })
    );

    await prisma.$transaction(ops);
  }

  return attempts.length;
}

/** Chấm lại mọi quiz (chưa xoá) có chứa câu hỏi vừa được sửa. */
export async function regradeQuizzesForQuestion(
  prisma: PrismaClient,
  questionId: string
): Promise<number> {
  const links = await prisma.quizQuestion.findMany({
    where: { questionId, quiz: { deletedAt: null } },
    select: { quizId: true },
  });

  let regraded = 0;
  for (const quizId of new Set(links.map((l) => l.quizId))) {
    regraded += await regradeQuizAttempts(prisma, quizId);
  }
  return regraded;
}
