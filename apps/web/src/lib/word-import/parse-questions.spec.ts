import { describe, it, expect } from 'vitest';
import { parseQuestions, chuanHoaCode, catDauHtml } from './parse-questions';
import type { DocLine } from './types';

/**
 * Bộ phân tích mẫu nhập đề từ Word.
 *
 * Mỗi khối dưới đây mô phỏng đúng thứ mà tầng đọc tệp giao xuống: một danh sách
 * đoạn văn (kèm cờ "nằm trong danh sách tự đánh số") và bảng. Sai hợp đồng này
 * là giáo viên nhập cả trăm câu rồi phát hiện đề lệch.
 *
 * `html` là RUỘT của đoạn, đã escape, không có thẻ <p> bọc ngoài — đúng như
 * docx-to-lines giao. Trước đây bản giả ở đây tự bọc <p> nên lỗi các đoạn dính
 * vào nhau thành một dòng lọt qua mà không test nào bắt được.
 */

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function p(text: string, isListItem = false): DocLine {
  return { kind: 'para', html: escape(text), text, isListItem };
}

/** Đoạn có định dạng: tự viết HTML, `text` là phần chữ của nó. */
function ph(html: string, extra: { isCode?: boolean } = {}): DocLine {
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { kind: 'para', html, text, isListItem: false, ...extra };
}

/** Một dòng gõ bằng phông đều nét (Consolas…). */
function pm(text: string): DocLine {
  return { kind: 'para', html: escape(text), text: text.trim(), isListItem: false, isCode: true };
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
    expect(c.options[0]!.content).toBe('<p>Hà Nội</p>');
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
    expect(c.options.map((o) => o.content)).toEqual([
      '<p>Hà Nội</p>',
      '<p>Huế</p>',
      '<p>Đà Nẵng</p>',
    ]);
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
    expect(c.options.map((o) => o.content)).toEqual([
      '<p>một</p>',
      '<p>hai</p>',
      '<p>ba</p>',
      '<p>bốn</p>',
    ]);
    expect(c.options.map((o) => o.isCorrect)).toEqual([false, false, true, false]);
  });

  it('bảng dữ liệu trong đề (không có mốc nào) được giữ nguyên là bảng', () => {
    const c = parseQuestions([
      p('Câu 1. [DSN] Cho bảng HocSinh sau:'),
      bang([
        ['<p><strong>STT</strong></p>', '<p><strong>HO VA TEN</strong></p>'],
        ['<p>1</p>', '<p>NGUYEN AN</p>'],
      ]),
      p('a) Trường STT là khoá chính.'),
      p('b) Bảng có hai bản ghi.'),
      p('Đáp án: Đ, S'),
    ]).questions[0]!;
    expect(c.loi).toEqual([]);
    expect(c.content).toBe(
      '<p>Cho bảng HocSinh sau:</p>' +
        '<table><tbody>' +
        '<tr><td><p><strong>STT</strong></p></td><td><p><strong>HO VA TEN</strong></p></td></tr>' +
        '<tr><td><p>1</p></td><td><p>NGUYEN AN</p></td></tr>' +
        '</tbody></table>'
    );
    expect(c.options).toHaveLength(2);
  });

  it('một ô bảng chứa hai đoạn thì tách thành hai phương án', () => {
    const lines: DocLine[] = [
      p('Câu 1. [TN1] Chọn đáp án đúng.'),
      bang([['<p>A. một</p><p>B. hai</p>', '<p>C. ba</p>']]),
      p('Đáp án: B'),
    ];
    const c = parseQuestions(lines).questions[0]!;
    expect(c.options.map((o) => o.content)).toEqual(['<p>một</p>', '<p>hai</p>', '<p>ba</p>']);
  });

  it('ô bảng test gõ nhiều dòng giữ nguyên dấu xuống dòng', () => {
    const c = parseQuestions([
      p('Câu 1. [PY] Tìm số lớn nhất.'),
      p('Test:'),
      bang([
        ['<p>Đầu vào</p>', '<p>Kết quả</p>'],
        ['<p>3</p><p>1 5 3</p>', '<p>5</p>'],
      ]),
    ]).questions[0]!;
    expect(c.testCases[0]!.input).toBe('3\n1 5 3');
  });
});

describe('giữ định dạng của đề', () => {
  it('thẻ HTML viết trong đề là chữ, không thành thẻ thật', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Thẻ <p> dùng để làm gì?'),
      p('A. Tạo đoạn văn <p>'),
      p('B. Xuống dòng <br>'),
      p('Đáp án: A'),
      p('Giải thích: Thẻ <p> bao một đoạn văn.'),
    ]).questions[0]!;
    expect(c.content).toBe('<p>Thẻ &lt;p&gt; dùng để làm gì?</p>');
    expect(c.options[1]!.content).toBe('<p>Xuống dòng &lt;br&gt;</p>');
    expect(c.explanation).toBe('<p>Thẻ &lt;p&gt; bao một đoạn văn.</p>');
  });

  it('mỗi đoạn của đề và giải thích là một đoạn riêng, không dính thành một dòng', () => {
    const c = parseQuestions(
      doc(`
        Câu 1. [TL] Dòng một
        Dòng hai
        Giải thích: Ý một
        Ý hai
      `)
    ).questions[0]!;
    expect(c.content).toBe('<p>Dòng một</p><p>Dòng hai</p>');
    expect(c.explanation).toBe('<p>Ý một</p><p>Ý hai</p>');
  });

  it('dòng đầu giữ in đậm và xuống dòng mềm, bỏ đúng phần "Câu 1."', () => {
    const c = parseQuestions([
      ph('<strong>Câu 1.</strong> [TL] Cho <em>đoạn</em> mã:<br />&lt;ul&gt;'),
    ]).questions[0]!;
    expect(c.content).toBe('<p>Cho <em>đoạn</em> mã:<br />&lt;ul&gt;</p>');
  });

  it('phương án giữ định dạng và xuống dòng', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Hỏi?'),
      ph('A. Dùng thẻ <code>&lt;li&gt;</code><br />trong danh sách'),
      p('B. Không'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.options[0]!.content).toBe(
      '<p>Dùng thẻ <code>&lt;li&gt;</code><br />trong danh sách</p>'
    );
  });

  it('thụt lề bằng dấu cách và tab không bị HTML gộp mất', () => {
    const c = parseQuestions([
      p('Câu 1. [TL] Cho đoạn mã:'),
      p('<body>'),
      p('    <h1>Xin chào</h1>'),
      ph('\t&lt;p&gt;'),
    ]).questions[0]!;
    expect(c.content).toContain('<p>&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;Xin chào&lt;/h1&gt;</p>');
    expect(c.content).toContain('<p>&nbsp;&nbsp;&nbsp;&nbsp;&lt;p&gt;</p>');
  });

  it('các dòng gõ phông đều nét trong đề gom thành một khối mã', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Đoạn mã sau hiển thị gì?'),
      pm('<ul>'),
      pm('    <li>Một</li>'),
      pm('</ul>'),
      p('Chọn đáp án đúng.'),
      p('A. Một danh sách'),
      p('B. Một bảng'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.content).toBe(
      '<p>Đoạn mã sau hiển thị gì?</p>' +
        '<pre><code>&lt;ul&gt;\n    &lt;li&gt;Một&lt;/li&gt;\n&lt;/ul&gt;</code></pre>' +
        '<p>Chọn đáp án đúng.</p>'
    );
    expect(c.options).toHaveLength(2);
  });

  it('cả câu gõ phông đều nét (như tệp mẫu) thì không đoán là mã', () => {
    const c = parseQuestions([
      pm('Câu 1. [TL] Cho hàm số y = x^3. Tìm m để đồ thị có hai điểm'),
      pm('cực trị nằm về hai phía trục hoành.'),
    ]).questions[0]!;
    expect(c.content).not.toContain('<pre>');
    expect(c.content).toContain('<p>cực trị nằm về hai phía trục hoành.</p>');
  });

  it('khối mã sau nhãn Code mẫu giữ nguyên các dấu cách liền nhau', () => {
    const c = parseQuestions([p('Câu 1. [WEB] Tạo trang.'), ph('Code mẫu: &lt;p  class="a"&gt;')])
      .questions[0]!;
    expect(c.starterCode).toBe('<p  class="a">');
  });
});

describe('đề có mã Python và C++', () => {
  it('đoạn Python dán vào đề giữ thụt lề, nháy cong trong mã được trả lại nháy thẳng', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Chương trình sau in ra gì?'),
      pm('s = 0'),
      pm('for i in range(1, 4):'),
      pm('    s += i  # cộng dồn'),
      pm('print(“Tổng:”, s)'),
      p('A. 6'),
      p('B. 10'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.loi).toEqual([]);
    expect(c.content).toContain(
      '<pre><code>s = 0\nfor i in range(1, 4):\n    s += i  # cộng dồn\nprint("Tổng:", s)</code></pre>'
    );
  });

  it('biến tên cau1 trong mã không bị hiểu là "Câu 1"', () => {
    const r = parseQuestions([
      p('Câu 1. [TN1] Chương trình Python sau in gì?'),
      pm('cau1 = [1, 2]'),
      pm('cau1.append(3)'),
      pm('print(len(cau1))'),
      p('A. 3'),
      p('B. 2'),
      p('Đáp án: A'),
    ]);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]!.loi).toEqual([]);
    expect(r.questions[0]!.content).toContain('cau1.append(3)');
  });

  it('"Câu1." viết liền vẫn là mốc câu hỏi', () => {
    const r = parseQuestions(doc(`Câu1. [TL] Đề một\nCâu2 [TL] Đề hai\nCâu3: Đề ba`));
    expect(r.questions.map((q) => q.nhan)).toEqual(['Câu 1', 'Câu 2', 'Câu 3']);
  });

  it('phương án là cả đoạn mã nhiều dòng, "A." đứng riêng một dòng', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Đoạn nào đúng cú pháp?'),
      p('A.'),
      pm('for i in range(3):'),
      pm('    print(i)'),
      p('B.'),
      pm('for i in range(3)'),
      pm('    print(i)'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.loi).toEqual([]);
    expect(c.options.map((o) => o.content)).toEqual([
      '<pre><code>for i in range(3):\n    print(i)</code></pre>',
      '<pre><code>for i in range(3)\n    print(i)</code></pre>',
    ]);
  });

  it('"A." đứng riêng mà không có gì bên dưới thì báo lỗi', () => {
    const c = parseQuestions(doc(`Câu 1. [TN1] Hỏi?\nA.\nB. hai\nĐáp án: B`)).questions[0]!;
    expect(c.loi.join(' ')).toContain('Phương án A không có nội dung');
  });

  it('phương án C++ gõ Consolas hiện như mã trong dòng', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Lệnh nào in ra màn hình?'),
      pm('A. cout << x;'),
      pm('B. cin >> x;'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.options.map((o) => o.content)).toEqual([
      '<p><code>cout &lt;&lt; x;</code></p>',
      '<p><code>cin &gt;&gt; x;</code></p>',
    ]);
  });

  it('câu văn bị Word giữ phông Consolas sau khi dán mã không bị nuốt vào khối mã', () => {
    const c = parseQuestions([
      p('Câu 1. [TN1] Cho đoạn mã:'),
      pm('#include <iostream>'),
      pm('int main() { std::cout << 3 - 1; }'),
      pm('Kết quả in ra màn hình là gì?'),
      pm('A. 2'),
      pm('B. 3'),
      p('Đáp án: A'),
    ]).questions[0]!;
    expect(c.content).toBe(
      '<p>Cho đoạn mã:</p>' +
        '<pre><code>#include &lt;iostream&gt;\nint main() { std::cout &lt;&lt; 3 - 1; }</code></pre>' +
        '<p>Kết quả in ra màn hình là gì?</p>'
    );
    // "2", "3" không có ký hiệu lệnh nào: giữ là chữ thường, không bọc mã.
    expect(c.options.map((o) => o.content)).toEqual(['<p>2</p>', '<p>3</p>']);
  });
});

describe('cắt tiền tố khỏi HTML', () => {
  it('giữ thẻ bọc ngoài, bỏ thẻ rỗng ruột', () => {
    expect(catDauHtml('<strong>Câu 1.</strong> Nội <em>dung</em>', 5)).toBe('Nội <em>dung</em>');
    expect(catDauHtml('<strong>A. Hà</strong> Nội', 2)).toBe('<strong>Hà</strong> Nội');
  });

  it('thực thể tính là một ký tự', () => {
    expect(catDauHtml('A. &lt;p&gt; thẻ', 2)).toBe('&lt;p&gt; thẻ');
    expect(catDauHtml('&lt;b&gt;: đậm', 4)).toBe('đậm');
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
