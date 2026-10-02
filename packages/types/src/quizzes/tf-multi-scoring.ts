/**
 * Thang điểm câu Đúng/Sai nhiều phát biểu.
 *
 * Lưu theo TỈ LỆ so với điểm của câu chứ không lưu điểm: cùng một câu vào quiz
 * khác có thể được đặt điểm khác (QuizQuestion.points), tỉ lệ thì nhân theo
 * được. Phần tử thứ k là tỉ lệ khi đúng k ý (k = 0..n), nên mảng dài n + 1,
 * đầu luôn 0 và cuối luôn 1 — đúng hết là trọn điểm của câu.
 *
 * Mảng rỗng = chia đều theo số ý đúng, cách chấm có từ trước khi có thang điểm.
 *
 * Dùng chung cho bộ chấm (API), xem trước quiz, form soạn câu và bộ nhập Word —
 * chấm một kiểu, xem trước một kiểu là giáo viên mất niềm tin vào điểm.
 */

/** Thang đề thi tốt nghiệp THPT từ 2025 cho câu 4 ý: 0,1 · 0,25 · 0,5 · 1. */
export const THPT_TF4_RATIOS: readonly number[] = [0, 0.1, 0.25, 0.5, 1];

/** Thang mặc định cho câu mới: 4 ý theo đề THPT, số ý khác chia đều. */
export function defaultTfRatios(statementCount: number): number[] {
  return statementCount === 4 ? [...THPT_TF4_RATIOS] : [];
}

/** Thang chia đều viết thành bảng — để form điền sẵn khi giáo viên tự chỉnh. */
export function evenTfRatios(statementCount: number): number[] {
  return Array.from({ length: statementCount + 1 }, (_, k) =>
    statementCount > 0 ? k / statementCount : 0
  );
}

/**
 * Chuẩn hoá thang điểm gửi lên. Sai độ dài so với số phát biểu hay có giá trị
 * không phải số thì trả rỗng (chia đều) thay vì chấm theo một bảng lệch.
 */
export function normalizeTfRatios(raw: unknown, statementCount: number): number[] {
  if (!Array.isArray(raw) || statementCount < 1 || raw.length !== statementCount + 1) return [];
  const values = raw.map(Number);
  if (values.some((v) => !Number.isFinite(v))) return [];
  return values.map((v, k) =>
    k === 0 ? 0 : k === statementCount ? 1 : Math.min(1, Math.max(0, v))
  );
}

/** Điểm khi học sinh đúng `correct` trên `total` phát biểu. */
export function tfMultiScore(
  correct: number,
  total: number,
  points: number,
  ratios?: readonly number[] | null
): number {
  if (total <= 0) return 0;
  const ratio = ratios && ratios.length === total + 1 ? ratios[correct] : undefined;
  if (ratio !== undefined && Number.isFinite(ratio)) {
    // Làm tròn 2 chữ số: thang THPT có 0,25 — làm tròn 1 chữ số là thành 0,3.
    return Math.round(Math.min(1, Math.max(0, ratio)) * points * 100) / 100;
  }
  // Chia đều giữ nguyên cách làm tròn cũ, để câu soạn trước không đổi điểm.
  return Math.round((correct / total) * points * 10) / 10;
}
