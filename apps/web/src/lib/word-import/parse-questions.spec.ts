import { describe, it, expect } from 'vitest';
import { parseQuestions, chuanHoaCode } from './parse-questions';
import type { DocLine } from './types';

/**
 * Bộ phân tích mẫu nhập đề từ Word.
 *
 * Mỗi khối dưới đây mô phỏng đúng thứ mà tầng đọc tệp giao xuống: một danh sách
 * đoạn văn (kèm cờ "nằm trong danh sách tự đánh số") và bảng. Sai hợp đồng này
 * là giáo viên nhập cả trăm câu rồi phát hiện đề lệch.
 */

function p(text: string, isListItem = false): DocLine {
  return { kind: 'para', html: `<p>${text}</p>`, text, isListItem };
}

function bang(rows: string[][]): DocLine {
  return { kind: 'table', rows };
}

/** Viết đề cho gọn: mỗi dòng một đoạn văn. */
function doc(nguon: string): DocLine[] {
  return nguon
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => p(l));
}

describe('trắc nghiệm', () => {
  const kq = parseQuestions(
    doc(`
      Câu 1. [TN1] Thủ đô của Việt Nam là thành phố nào?
      A. Hà Nội
      B. Huế
      C. Đà Nẵng
      Đáp án: A
      Giải thích: Theo Hiến pháp.
      Điểm: 0.5
    `)
  );
  const c = kq.questions[0]!;

  it('không báo lỗi', () => {
    expect(c.loi).toEqual([]);
    expect(kq.loiChung).toEqual([]);
  });

  it('đọc đúng loại, điểm và giải thích', () => {
    expect(c.type).toBe('MULTIPLE_CHOICE_SINGLE');
    expect(c.points).toBe(0.5);
    expect(c.explanation).toContain('Hiến pháp');
  });

  it('đánh dấu đúng phương án', () => {
    expect(c.options.map((o) => o.isCorrect)).toEqual([true, false, false]);
    expect(c.options[0]!.content).toBe('Hà Nội');
  });

  it('điểm mặc định là 1 khi bỏ trống', () => {
    const r = parseQuestions(doc(`Câu 1. [TN1] Hỏi?\nA. a\nB. b\nĐáp án: B`));
    expect(r.questions[0]!.points).toBe(1);
  });

  it('bỏ trống mã loại thì hiểu là trắc nghiệm một đáp án', () => {
    const r = parseQuestions(doc(`Câu 1. Hỏi?\nA. a\nB. b\nĐáp án: B`));
    expect(r.questions[0]!.type).toBe('MULTIPLE_CHOICE_SINGLE');
    expect(r.questions[0]!.loi).toEqual([]);
  });

  it('nhiều đáp án nhận dãy chữ cái', () => {
    const r = parseQuestions(doc(`Câu 1. [TNN] Chọn các số chẵn\nA. 2\nB. 3\nC. 4\nĐáp án: A, C`));
    expect(r.questions[0]!.options.map((o) => o.isCorrect)).toEqual([true, false, true]);
  });

  it('một đáp án mà ghi hai chữ cái thì báo lỗi', () => {
    const r = parseQuestions(doc(`Câu 1. [TN1] Hỏi?\nA. a\nB. b\nĐáp án: A, B`));
    expect(r.questions[0]!.loi.join(' ')).toContain('nhiều chữ cái');
  });

  it('đáp án trỏ tới phương án không tồn tại thì báo lỗi', () => {
    const r = parseQuestions(doc(`Câu 1. [TN1] Hỏi?\nA. a\nB. b\nĐáp án: D`));
    expect(r.questions[0]!.loi.join(' ')).toContain('không có');
  });
});

describe('thư mục', () => {
  it('khai một lần, áp cho mọi câu phía sau', () => {
    const r = parseQuestions(
      doc(`
        Thư mục: Chương 1
        Câu 1. [TN1] Hỏi một?
        A. a
        B. b
        Đáp án: A
        Câu 2. [TN1] Hỏi hai?
        A. a
        B. b
        Đáp án: B
      `)
    );
    expect(r.questions.map((q) => q.folder)).toEqual(['Chương 1', 'Chương 1']);
  });

  it('khai lại thì các câu sau đổi sang thư mục mới', () => {
    const r = parseQuestions(
      doc(`
        Thư mục: Chương 1
        Câu 1. [TL] Đề một
        Thư mục: Chương 2
        Câu 2. [TL] Đề hai
      `)
    );
    expect(r.questions.map((q) => q.folder)).toEqual(['Chương 1', 'Chương 2']);
  });
});

describe('nối dòng', () => {
  it('công thức đứng riêng dòng vẫn thuộc đề bài', () => {
    const r = parseQuestions(
      doc(`
        Câu 1. [TN1] Cho hàm số liên tục thoả mãn
        $$\\int_0^2 f(x)dx = 5$$
        Khi đó giá trị của tích phân bằng bao nhiêu?
        A. 9
        B. 6
        Đáp án: A
      `)
    );
    const c = r.questions[0]!;
    expect(c.content).toContain('int_0^2');
    expect(c.content).toContain('Khi đó giá trị');
    expect(c.options).toHaveLength(2);
  });

  it('dòng có dấu hai chấm nhưng không phải nhãn thì vẫn là đề bài', () => {
    const r = parseQuestions(doc(`Câu 1. [TL] Giải phương trình\nĐặt: t = x^2\nTìm t.`));
    expect(r.questions[0]!.content).toContain('Đặt: t = x^2');
    expect(r.questions[0]!.loi).toEqual([]);
  });

  it('nhãn Đề gom trọn phần đề bài', () => {
    const r = parseQuestions(doc(`Câu 1. [TN1] \nĐề: Dòng một\nDòng hai\nA. a\nB. b\nĐáp án: A`));
    const c = r.questions[0]!;
    expect(c.content).toContain('Dòng một');
    expect(c.content).toContain('Dòng hai');
  });
});

describe('đúng sai', () => {
  it('đúng sai đơn tự sinh hai lựa chọn', () => {
    const r = parseQuestions(doc(`Câu 1. [DS] Số 2 là số nguyên tố.\nĐáp án: Đ`));
    const c = r.questions[0]!;
    expect(c.options).toEqual([
      { content: 'Đúng', isCorrect: true },
      { content: 'Sai', isCorrect: false },
    ]);
    expect(c.loi).toEqual([]);
  });

  it('đúng sai nhiều ý khớp theo vị trí', () => {
    const r = parseQuestions(
      doc(`
        Câu 1. [DSN] Xét các phát biểu sau:
        A. Phát biểu một
        B. Phát biểu hai
        C. Phát biểu ba
        D. Phát biểu bốn
        Đáp án: Đ, S, Đ, S
      `)
    );
    expect(r.questions[0]!.options.map((o) => o.isCorrect)).toEqual([true, false, true, false]);
  });

  it('số ý không khớp số đáp án thì báo lỗi', () => {
    const r = parseQuestions(doc(`Câu 1. [DSN] Xét:\nA. một\nB. hai\nC. ba\nĐáp án: Đ, S`));
    expect(r.questions[0]!.loi.join(' ')).toContain('phát biểu');
  });
});

describe('ghép nối và sắp xếp', () => {
  it('ghép nối tách hai vế bằng dấu gạch đứng', () => {
    const r = parseQuestions(
      doc(`
        Câu 1. [GN] Ghép hàm số với đạo hàm.
        A. sin x | cos x
        B. ln x | 1/x
      `)
    );
    const c = r.questions[0]!;
    expect(c.loi).toEqual([]);
    expect(JSON.parse(c.options[0]!.content)).toEqual({ left: 'sin x', right: 'cos x' });
  });

  it('cặp thiếu một vế thì báo lỗi', () => {
    const r = parseQuestions(doc(`Câu 1. [GN] Ghép\nA. sin x\nB. ln x | 1/x`));
    expect(r.questions[0]!.loi.join(' ')).toContain('thiếu một vế');
  });

  it('sắp xếp giữ nguyên thứ tự đã liệt kê', () => {
    const r = parseQuestions(doc(`Câu 1. [SX] Sắp xếp\nA. bước một\nB. bước hai\nC. bước ba`));
    expect(r.questions[0]!.options.map((o) => o.content)).toEqual([
      'bước một',
      'bước hai',
      'bước ba',
    ]);
  });
});

describe('trả lời ngắn', () => {
  it('nhiều cách viết ngăn bởi dấu gạch đứng', () => {
    const r = parseQuestions(doc(`Câu 1. [TLN] Tính một phần hai.\nĐáp án: 0.5 | 1/2`));
    const c = r.questions[0]!;
    expect(c.type).toBe('SHORT_ANSWER');
    expect(c.options.map((o) => o.content)).toEqual(['0.5', '1/2']);
    expect(c.options.every((o) => o.isCorrect)).toBe(true);
  });

  it('thiếu đáp án thì báo lỗi', () => {
    const r = parseQuestions(doc(`Câu 1. [TLN] Tính.`));
    expect(r.questions[0]!.loi.join(' ')).toContain('ít nhất một đáp án');
  });
});

describe('câu lập trình', () => {
  it('Parsons lấy dòng lệnh từ khối mã và giữ thụt lề', () => {
    const lines: DocLine[] = [
      p('Câu 1. [PARSONS] Sắp xếp các dòng lệnh.'),
      p('Code mẫu:'),
      p('n = int(input())'),
      p('for i in range(n):'),
      p('    print(i)'),
    ];
    const c = parseQuestions(lines).questions[0]!;
    expect(c.loi).toEqual([]);
    expect(c.options.map((o) => o.content)).toEqual([
      'n = int(input())',
      'for i in range(n):',
      '    print(i)',
    ]);
    expect(c.starterCode).toBeNull();
  });

  it('điền khuyết đòi số chỗ trống khớp số đáp án', () => {
    const ok = parseQuestions([
      p('Câu 1. [DK] Điền vào chỗ trống.'),
      p('Code mẫu:'),
      p('d = ___'),
      p('d = ___'),
      p('Đáp án: 0 | d + 1'),
    ]).questions[0]!;
    expect(ok.loi).toEqual([]);
    expect(ok.starterCode).toBe('d = ___\nd = ___');

    const lech = parseQuestions([
      p('Câu 1. [DK] Điền.'),
      p('Code mẫu:'),
      p('d = ___'),
      p('Đáp án: 0 | 1'),
    ]).questions[0]!;
    expect(lech.loi.join(' ')).toContain('không khớp');
  });

  it('đọc bảng test case, nhận cả cột ẩn và cột điểm', () => {
    const lines: DocLine[] = [
      p('Câu 1. [PY] In ra tổng dãy số.'),
      p('Đáp án code:'),
      p('print(sum(map(int, input().split())))'),
      p('Test:'),
      bang([
        ['Đầu vào', 'Kết quả', 'Ẩn', 'Điểm'],
        ['1 2 3', '6', '', '1'],
        ['5 5', '10', 'x', '2'],
      ]),
    ];
    const c = parseQuestions(lines).questions[0]!;
    expect(c.loi).toEqual([]);
    expect(c.testCases).toEqual([
      { input: '1 2 3', expectedOutput: '6', isHidden: false, points: 1 },
      { input: '5 5', expectedOutput: '10', isHidden: true, points: 2 },
    ]);
    expect(c.solutionCode).toContain('print(sum');
    expect(c.timeLimit).toBe(3);
    expect(c.memoryLimit).toBe(256 * 1024);
  });

  it('dạng test viết gọn một dòng, có đánh dấu ẩn và điểm', () => {
    const c = parseQuestions(
      doc(`
        Câu 1. [PY] Bình phương.
        Test: 5 => 25
        Test: 9 => 81 [ẩn] [2đ]
        Thời gian: 2
        Bộ nhớ: 128
      `)
    ).questions[0]!;
    expect(c.testCases).toEqual([
      { input: '5', expectedOutput: '25', isHidden: false, points: 1 },
      { input: '9', expectedOutput: '81', isHidden: true, points: 2 },
    ]);
    expect(c.timeLimit).toBe(2);
    expect(c.memoryLimit).toBe(128 * 1024);
  });

  it('câu lập trình không có test thì báo lỗi', () => {
    const c = parseQuestions(doc(`Câu 1. [PY] Viết chương trình.`)).questions[0]!;
    expect(c.loi.join(' ')).toContain('Test');
  });
});

describe('Word phá code', () => {
  it('trả lại nháy thẳng, toán tử con trỏ và hai dấu trừ', () => {
    expect(chuanHoaCode('print(\u201cxin ch\u00e0o\u201d)')).toBe('print("xin chào")');
    expect(chuanHoaCode('p\u2192next')).toBe('p->next');
    expect(chuanHoaCode('i\u2013\u2013')).toBe('i----');
    expect(chuanHoaCode('s = \u2018a\u2019')).toBe("s = 'a'");
  });

  it('khối mã trong đề được chuẩn hoá', () => {
    const c = parseQuestions([
      p('Câu 1. [PY] Sửa.'),
      p('Code mẫu:'),
      p('print(\u201chello\u201d)'),
      p('Test: 1 => 1'),
    ]).questions[0]!;
    expect(c.starterCode).toBe('print("hello")');
  });
});

describe('cách trình bày của Word', () => {
  it('danh sách tự đánh số được nhận làm phương án', () => {
    const lines: DocLine[] = [
      p('Câu 1. [TN1] Chọn đáp án đúng.'),
      p('Hà Nội', true),
      p('Huế', true),
      p('Đà Nẵng', true),
      p('Đáp án: A'),
    ];
    const c = parseQuestions(lines).questions[0]!;
    expect(c.options.map((o) => o.content)).toEqual(['Hà Nội', 'Huế', 'Đà Nẵng']);
    expect(c.options[0]!.isCorrect).toBe(true);
  });

  it('bảng hai cột chứa bốn phương án được trải phẳng theo thứ tự đọc', () => {
    const lines: DocLine[] = [
      p('Câu 1. [TN1] Chọn đáp án đúng.'),
      bang([
        ['<p>A. một</p>', '<p>B. hai</p>'],
        ['<p>C. ba</p>', '<p>D. bốn</p>'],
      ]),
      p('Đáp án: C'),
    ];
    const c = parseQuestions(lines).questions[0]!;
    expect(c.options.map((o) => o.content)).toEqual(['một', 'hai', 'ba', 'bốn']);
    expect(c.options.map((o) => o.isCorrect)).toEqual([false, false, true, false]);
  });
});

describe('lỗi ở mức tài liệu', () => {
  it('tài liệu không có câu nào', () => {
    const r = parseQuestions(doc(`Đây chỉ là một đoạn văn bình thường.`));
    expect(r.questions).toHaveLength(0);
    expect(r.loiChung.join(' ')).toContain('Không tìm thấy câu hỏi nào');
  });

  it('mã loại lạ thì báo rõ tên mã', () => {
    const c = parseQuestions(doc(`Câu 1. [ABC] Hỏi?`)).questions[0]!;
    expect(c.loi.join(' ')).toContain('ABC');
  });

  it('câu không có đề bài thì báo lỗi', () => {
    const c = parseQuestions(doc(`Câu 1. [TN1]\nA. a\nB. b\nĐáp án: A`)).questions[0]!;
    expect(c.loi.join(' ')).toContain('không có đề bài');
  });

  it('nhiều câu liên tiếp được tách đúng', () => {
    const r = parseQuestions(
      doc(`
        Câu 1. [TL] Đề một
        Câu 2. [TL] Đề hai
        Câu 3. [TL] Đề ba
      `)
    );
    expect(r.questions.map((q) => q.nhan)).toEqual(['Câu 1', 'Câu 2', 'Câu 3']);
  });
});
