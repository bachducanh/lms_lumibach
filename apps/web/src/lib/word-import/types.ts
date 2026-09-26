/**
 * Kiểu dùng chung cho luồng nhập đề từ Word.
 *
 * Luồng chia ba tầng để phần dễ sai nhất kiểm thử được mà không cần trình duyệt:
 *
 *   docx  →  DocLine[]        (đọc tệp, cần DOM — xem docx-to-lines.ts)
 *   DocLine[] →  ParsedQuestion[]   (thuần, xem parse-questions.ts)
 *   ParsedQuestion[] → API          (xem màn hình nhập)
 */

/** Một đoạn văn trong tài liệu. `html` giữ định dạng, `text` để dò nhãn. */
export type DocPara = {
  kind: 'para';
  html: string;
  text: string;
  /** Đoạn nằm trong danh sách tự đánh số của Word — chữ cái A/B/C không nằm
   *  trong văn bản mà là định dạng, nên bộ phân tích phải tự gán. */
  isListItem: boolean;
  /** Cả đoạn gõ bằng phông chữ đều nét (Consolas, Courier…) — thường là mã
   *  nguồn dán từ trình soạn code. Bộ phân tích quyết định có dựng thành khối
   *  mã hay không, vì có người gõ CẢ tệp bằng phông đều nét. */
  isCode?: boolean;
};

/** Một bảng. Mỗi ô là HTML; bảng phương án sẽ được trải phẳng theo thứ tự đọc. */
export type DocTable = {
  kind: 'table';
  rows: string[][];
};

export type DocLine = DocPara | DocTable;

export type ParsedOption = { content: string; isCorrect: boolean };

export type ParsedTestCase = {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
};

export type ParsedQuestion = {
  /** Giá trị của enum QuestionType. */
  type: string;
  /** Đề bài dạng HTML, đã gồm công thức và ảnh. */
  content: string;
  explanation: string | null;
  points: number;
  /** Tên thư mục trong kho; null là để ngoài thư mục. */
  folder: string | null;
  options: ParsedOption[];
  testCases: ParsedTestCase[];
  starterCode: string | null;
  solutionCode: string | null;
  timeLimit: number | null;
  memoryLimit: number | null;
  /** Nhãn hiện cho người dùng, ví dụ "Câu 3". */
  nhan: string;
  /** Lỗi khiến câu này KHÔNG nhập được. Rỗng là nhập được. */
  loi: string[];
  /** Điều đáng ngờ nhưng vẫn nhập được, ví dụ đề rất ngắn. */
  canhBao: string[];
};

export type ParseResult = {
  questions: ParsedQuestion[];
  /** Lỗi ở mức tài liệu, ví dụ không tìm thấy câu nào. */
  loiChung: string[];
};
