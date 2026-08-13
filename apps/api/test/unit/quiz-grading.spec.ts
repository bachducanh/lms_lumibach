import { describe, it, expect } from 'vitest';
import { gradeOptionAnswer, type GradableOption } from '../../src/common/grading/quiz-grading';

/**
 * Chấm tự động cho MỌI loại câu hỏi quiz.
 *
 * Mỗi khối mô phỏng đúng thứ mà QuizTaker gửi lên cho loại đó:
 *   MCQ  → selectedOptionIds (JSON mảng id)
 *   TF   → booleanAnswer
 *   ESSAY→ textAnswer (JSON mảng / map / chuỗi, tuỳ loại)
 * Sai hợp đồng này là học sinh làm bài xong nhưng không ra điểm.
 */

function opt(id: string, content: string, isCorrect: boolean, position = 0): GradableOption {
  return { id, content, isCorrect, position };
}

const NO_ANSWER = null;
const mcq = (ids: string[]) => ({
  selectedOptionIds: JSON.stringify(ids),
  booleanAnswer: null,
  textAnswer: null,
});
const tf = (v: boolean) => ({ selectedOptionIds: null, booleanAnswer: v, textAnswer: null });
const text = (v: unknown) => ({
  selectedOptionIds: null,
  booleanAnswer: null,
  textAnswer: typeof v === 'string' ? v : JSON.stringify(v),
});

describe('MULTIPLE_CHOICE_SINGLE', () => {
  const options = [opt('a', 'Hà Nội', true), opt('b', 'Huế', false), opt('c', 'Đà Nẵng', false)];

  it('chọn đúng → trọn điểm', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_SINGLE', options, 2, mcq(['a']))).toEqual({
      isCorrect: true,
      score: 2,
    });
  });

  it('chọn sai → 0', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_SINGLE', options, 2, mcq(['b']))?.score).toBe(0);
  });

  it('không trả lời → 0', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_SINGLE', options, 2, NO_ANSWER)?.score).toBe(0);
  });
});

describe('MULTIPLE_CHOICE_MULTIPLE', () => {
  const options = [opt('a', 'A', true), opt('b', 'B', true), opt('c', 'C', false)];

  it('chọn đúng đủ bộ → trọn điểm', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_MULTIPLE', options, 3, mcq(['a', 'b']))).toEqual({
      isCorrect: true,
      score: 3,
    });
  });

  it('thứ tự chọn không quan trọng', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_MULTIPLE', options, 3, mcq(['b', 'a']))?.score).toBe(
      3
    );
  });

  it('thiếu một ý → 0 (không có điểm thành phần)', () => {
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_MULTIPLE', options, 3, mcq(['a']))?.score).toBe(0);
  });

  it('chọn thừa ý sai → 0', () => {
    expect(
      gradeOptionAnswer('MULTIPLE_CHOICE_MULTIPLE', options, 3, mcq(['a', 'b', 'c']))?.score
    ).toBe(0);
  });
});

describe('TRUE_FALSE', () => {
  it('đáp án Đúng, học sinh chọn Đúng → trọn điểm', () => {
    const options = [opt('t', 'Đúng', true), opt('f', 'Sai', false)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, tf(true))).toEqual({
      isCorrect: true,
      score: 1,
    });
  });

  it('đáp án Sai, học sinh chọn Sai → trọn điểm', () => {
    const options = [opt('t', 'Đúng', false), opt('f', 'Sai', true)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, tf(false))?.score).toBe(1);
  });

  it('chọn ngược → 0', () => {
    const options = [opt('t', 'Đúng', true), opt('f', 'Sai', false)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, tf(false))?.score).toBe(0);
  });

  it('không trả lời → 0', () => {
    const options = [opt('t', 'Đúng', true), opt('f', 'Sai', false)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, NO_ANSWER)?.score).toBe(0);
  });

  // Câu nhập từ nguồn khác / bản dịch khác hay có nhãn khác đi.
  it('nhãn tiếng Anh vẫn chấm đúng', () => {
    const options = [opt('t', 'True', true), opt('f', 'False', false)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, tf(true))?.score).toBe(1);
  });

  it('nhãn có khoảng trắng thừa vẫn chấm đúng', () => {
    const options = [opt('t', ' Đúng ', true), opt('f', 'Sai', false)];
    expect(gradeOptionAnswer('TRUE_FALSE', options, 1, tf(true))?.score).toBe(1);
  });
});

describe('TRUE_FALSE_MULTI', () => {
  // Học sinh bấm "Đúng" cho ý nào thì id ý đó nằm trong selectedOptionIds;
  // ý bấm "Sai" thì không nằm trong danh sách.
  const options = [
    opt('s1', 'Phát biểu 1', true, 0),
    opt('s2', 'Phát biểu 2', false, 1),
    opt('s3', 'Phát biểu 3', true, 2),
    opt('s4', 'Phát biểu 4', false, 3),
  ];

  it('trả lời đúng hết → trọn điểm', () => {
    expect(gradeOptionAnswer('TRUE_FALSE_MULTI', options, 4, mcq(['s1', 's3']))).toEqual({
      isCorrect: true,
      score: 4,
    });
  });

  it('sai một ý → mất điểm ý đó', () => {
    const res = gradeOptionAnswer('TRUE_FALSE_MULTI', options, 4, mcq(['s1', 's2', 's3']));
    expect(res?.isCorrect).toBe(false);
    expect(res?.score).toBe(3);
  });

  it('trả lời Sai cho tất cả (có thao tác) → vẫn được điểm ý Sai', () => {
    const res = gradeOptionAnswer('TRUE_FALSE_MULTI', options, 4, mcq([]));
    expect(res?.score).toBe(2);
  });

  // Không đụng vào câu thì KHÔNG có dòng Answer nào — khác hẳn với "đã chọn Sai
  // hết". Không phân biệt hai ca này thì bỏ trắng vẫn được điểm, học sinh không
  // làm gì cũng có nửa số điểm.
  it('không trả lời → 0, không được điểm miễn phí', () => {
    expect(gradeOptionAnswer('TRUE_FALSE_MULTI', options, 4, NO_ANSWER)?.score).toBe(0);
  });
});

describe('PARSONS / ORDERING', () => {
  const options = [
    opt('l1', 'def f():', true, 0),
    opt('l2', '  return 1', true, 1),
    opt('l3', 'print(f())', true, 2),
  ];

  for (const type of ['PARSONS', 'ORDERING'] as const) {
    it(`${type}: đúng thứ tự → trọn điểm`, () => {
      expect(gradeOptionAnswer(type, options, 3, text(['l1', 'l2', 'l3']))).toEqual({
        isCorrect: true,
        score: 3,
      });
    });

    it(`${type}: sai thứ tự → điểm thành phần`, () => {
      const res = gradeOptionAnswer(type, options, 3, text(['l1', 'l3', 'l2']));
      expect(res?.isCorrect).toBe(false);
      expect(res?.score).toBe(1);
    });

    it(`${type}: không trả lời → 0`, () => {
      expect(gradeOptionAnswer(type, options, 3, NO_ANSWER)?.score).toBe(0);
    });

    it(`${type}: sắp thiếu dòng → chỉ tính dòng đúng chỗ`, () => {
      expect(gradeOptionAnswer(type, options, 3, text(['l1', 'l2']))?.score).toBe(2);
    });
  }
});

describe('CODE_FILL', () => {
  const options = [opt('b1', 'range', true, 0), opt('b2', 'len', true, 1)];

  it('điền đúng hết → trọn điểm', () => {
    expect(gradeOptionAnswer('CODE_FILL', options, 2, text(['range', 'len']))).toEqual({
      isCorrect: true,
      score: 2,
    });
  });

  it('thừa khoảng trắng vẫn tính đúng', () => {
    expect(gradeOptionAnswer('CODE_FILL', options, 2, text([' range ', 'len']))?.score).toBe(2);
  });

  it('sai một ô → điểm thành phần', () => {
    expect(gradeOptionAnswer('CODE_FILL', options, 2, text(['range', 'size']))?.score).toBe(1);
  });

  it('không trả lời → 0', () => {
    expect(gradeOptionAnswer('CODE_FILL', options, 2, NO_ANSWER)?.score).toBe(0);
  });
});

describe('MATCHING', () => {
  const options = [
    { ...opt('o1', JSON.stringify({ left: 'Đẳng cấp', right: 'Thầy Bạch' }), true, 0) },
    { ...opt('o2', JSON.stringify({ left: 'Đẹp trai', right: 'Thầy Bạch' }), true, 1) },
    { ...opt('o3', JSON.stringify({ left: 'Chăm chỉ', right: 'Học sinh' }), true, 2) },
  ];

  it('ghép đúng → trọn điểm', () => {
    expect(
      gradeOptionAnswer('MATCHING', options, 9, text({ o1: 'o1', o2: 'o2', o3: 'o3' }))
    ).toEqual({ isCorrect: true, score: 9 });
  });

  it('đổi chỗ hai thẻ TRÙNG CHỮ vẫn trọn điểm', () => {
    expect(
      gradeOptionAnswer('MATCHING', options, 9, text({ o1: 'o2', o2: 'o1', o3: 'o3' }))?.score
    ).toBe(9);
  });

  it('ghép sang vế phải khác chữ → mất điểm cặp đó', () => {
    expect(
      gradeOptionAnswer('MATCHING', options, 9, text({ o1: 'o3', o2: 'o2', o3: 'o3' }))?.score
    ).toBe(6);
  });

  it('không trả lời → 0', () => {
    expect(gradeOptionAnswer('MATCHING', options, 9, NO_ANSWER)?.score).toBe(0);
  });

  it('content hỏng → không tính là đúng', () => {
    const broken = [opt('b1', 'không phải JSON', true, 0)];
    expect(gradeOptionAnswer('MATCHING', broken, 5, text({ b1: 'b1' }))?.score).toBe(0);
  });
});

describe('Loại chấm tay / chấm bằng Judge0 — không tự chấm ở đây', () => {
  const options = [opt('a', 'A', true)];

  for (const type of ['ESSAY', 'CODE_WEB'] as const) {
    it(`${type} → null (giáo viên chấm tay)`, () => {
      expect(gradeOptionAnswer(type, options, 5, text('bài làm'))).toBeNull();
    });
  }

  for (const type of ['CODE_PYTHON', 'CODE_CPP', 'CODE_DEBUG_PYTHON', 'CODE_DEBUG_CPP'] as const) {
    it(`${type} → null (chấm bằng Judge0 lúc nộp)`, () => {
      expect(gradeOptionAnswer(type, options, 5, text('print(1)'))).toBeNull();
    });
  }
});

describe('Đề soạn thiếu — không được cho điểm nhầm', () => {
  it('MCQ không đánh dấu đáp án đúng nào → 0 dù chọn gì', () => {
    const options = [opt('a', 'A', false), opt('b', 'B', false)];
    expect(gradeOptionAnswer('MULTIPLE_CHOICE_SINGLE', options, 2, mcq(['a']))?.score).toBe(0);
  });

  it('câu không có option nào → 0', () => {
    expect(gradeOptionAnswer('ORDERING', [], 2, text([]))?.score).toBe(0);
  });
});
