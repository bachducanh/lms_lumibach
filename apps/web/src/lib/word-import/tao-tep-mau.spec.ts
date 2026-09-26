import { describe, it, expect } from 'vitest';
import { taoTepMau } from './tao-tep-mau';
import { docDocx } from './docx-to-lines';
import { parseQuestions } from './parse-questions';

/**
 * Tệp mẫu phải tự đọc lại được bằng chính bộ đọc.
 *
 * Đây là phép kiểm đáng giá nhất cho tệp mẫu: nếu quy ước đổi mà mẫu quên đổi
 * theo, giáo viên sẽ chép từ mẫu ra một tệp không nhập được, và lỗi đó rất khó
 * lần vì mẫu trông vẫn đúng.
 */

describe('tệp Word mẫu', () => {
  it('đọc lại được và mọi câu ví dụ đều hợp lệ', async () => {
    const buf = await taoTepMau();
    const { lines } = await docDocx(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      async () => 'http://khong-dung-toi'
    );
    const kq = parseQuestions(lines);

    expect(kq.questions.length, 'mẫu phải có đủ 14 câu ví dụ').toBe(14);

    const hong = kq.questions.filter((q) => q.loi.length > 0);
    expect(
      hong.map((q) => `${q.nhan}: ${q.loi.join('; ')}`),
      'không câu ví dụ nào được phép lỗi'
    ).toEqual([]);
  });

  it('ví dụ chèn mã vào đề dựng ra đúng khối mã, thẻ HTML còn nguyên là chữ', async () => {
    const buf = await taoTepMau();
    const { lines } = await docDocx(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      async () => 'http://khong-dung-toi'
    );
    const cau = parseQuestions(lines).questions.find((q) => q.nhan === 'Câu 13')!;
    expect(cau.content).toContain(
      '<pre><code>&lt;ul&gt;\n    &lt;li&gt;Bật máy&lt;/li&gt;\n    &lt;li&gt;Mở trình duyệt&lt;/li&gt;\n&lt;/ul&gt;</code></pre>'
    );
    expect(cau.explanation).toContain('Mỗi thẻ &lt;li&gt; tạo một mục');

    // Phương án là cả đoạn mã: "A." đứng riêng, mã dán ở dưới.
    const cau14 = parseQuestions(lines).questions.find((q) => q.nhan === 'Câu 14')!;
    expect(cau14.options.map((o) => o.content)).toEqual([
      '<pre><code>for i in range(3):\n    print(i)</code></pre>',
      '<pre><code>for i in range(1, 3):\n    print(i)</code></pre>',
    ]);

    // Các câu còn lại không có dòng Consolas nào trong đề nên không được sinh khối mã.
    const cau8 = parseQuestions(lines).questions.find((q) => q.nhan === 'Câu 8')!;
    expect(cau8.content).not.toContain('<pre>');
  });

  it('phủ hết các nhóm loại câu hỏi', async () => {
    const buf = await taoTepMau();
    const { lines } = await docDocx(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      async () => 'http://khong-dung-toi'
    );
    const loai = new Set(parseQuestions(lines).questions.map((q) => q.type));

    for (const can of [
      'MULTIPLE_CHOICE_SINGLE',
      'MULTIPLE_CHOICE_MULTIPLE',
      'TRUE_FALSE',
      'TRUE_FALSE_MULTI',
      'ESSAY',
      'SHORT_ANSWER',
      'ORDERING',
      'MATCHING',
      'PARSONS',
      'CODE_FILL',
      'CODE_PYTHON',
      'CODE_CPP',
    ]) {
      expect(loai.has(can), `mẫu thiếu ví dụ cho loại ${can}`).toBe(true);
    }
  });

  it('thư mục khai trong mẫu áp cho các câu ví dụ', async () => {
    const buf = await taoTepMau();
    const { lines } = await docDocx(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      async () => 'http://khong-dung-toi'
    );
    const q = parseQuestions(lines).questions;
    expect(q[0]!.folder).toBe('Chương 1 - Hàm số');
  });
});
