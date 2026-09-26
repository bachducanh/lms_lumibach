/**
 * Loại câu hỏi mà nội dung phương án là rich-text (HTML do trình soạn thảo sinh).
 *
 * Trắc nghiệm và các phát biểu Đúng/Sai được định dạng như đề bài: in đậm, đoạn
 * mã, công thức, ảnh, xuống dòng. Các loại còn lại vẫn giữ chữ thuần vì nội dung
 * của chúng được đem ra SO KHỚP (trả lời ngắn, điền khuyết), hoặc là nhãn cố định
 * (Đúng/Sai đơn), hoặc là JSON (ghép nối), hoặc là dòng lệnh (Parsons).
 *
 * Dữ liệu cũ đã được đổi sang HTML bằng migration
 * `20260926090000_rich_text_options`. Sửa danh sách này thì phải có migration đi kèm.
 */
const RICH_OPTION_TYPES: ReadonlySet<string> = new Set([
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE_MULTI',
]);

export function optionIsRich(type: string): boolean {
  return RICH_OPTION_TYPES.has(type);
}
