import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { docDocx } from './docx-to-lines';
import { parseQuestions } from './parse-questions';

/**
 * Chuỗi đọc tệp, kiểm trên một tệp .docx thật dựng ngay trong bộ nhớ.
 *
 * Mắt xích đáng lo nhất là công thức: Word lưu bằng OMML, mammoth bỏ qua không
 * báo gì, nên nếu bước đổi sang LaTeX hỏng thì đề toán nhập vào sẽ mất sạch
 * công thức mà không ai nhận ra cho tới lúc học sinh mở bài.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const doan = (trong: string) => `<w:p>${trong}</w:p>`;
const chu = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;

/** Phân số, đúng dạng Word sinh ra khi gõ bằng Equation. */
const phanSo = (tu: string, mau: string) =>
  `<m:oMath><m:f><m:num><m:r><m:t>${tu}</m:t></m:r></m:num>` +
  `<m:den><m:r><m:t>${mau}</m:t></m:r></m:den></m:f></m:oMath>`;

/** Công thức đứng riêng một dòng. */
const congThucRieng = (trong: string) => `<m:oMathPara>${trong}</m:oMathPara>`;

async function dungDocx(than: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:m="${M}"><w:body>${than}</w:body></w:document>`
  );
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const khongLuuAnh = async () => 'http://khong-dung-toi';

describe('đọc tệp .docx', () => {
  it('đổi công thức Office thành LaTeX ngay trong dòng chữ', async () => {
    const docx = await dungDocx(
      [
        doan(chu('Câu 1. [TN1] Giá trị của ') + phanSo('1', '2') + chu(' bằng bao nhiêu?')),
        doan(chu('A. 0,5')),
        doan(chu('B. 0,25')),
        doan(chu('Đáp án: A')),
      ].join('')
    );

    const kq = await docDocx(docx, khongLuuAnh);
    expect(kq.congThucThatBai).toBe(0);
    expect(kq.congThucDaDoi).toBe(1);

    const dong = kq.lines[0]!;
    expect(dong.kind).toBe('para');
    if (dong.kind !== 'para') throw new Error('phải là đoạn văn');
    // Công thức thành $...$ và nằm đúng chỗ giữa câu, không bị đẩy ra cuối.
    expect(dong.text).toMatch(/Giá trị của \$.*frac.*\$ bằng bao nhiêu\?/);
  });

  it('công thức đứng riêng dòng dùng hai dấu đô la', async () => {
    const docx = await dungDocx(
      [doan(chu('Câu 1. [TL] Tính tích phân sau')), doan(congThucRieng(phanSo('a', 'b')))].join('')
    );
    const kq = await docDocx(docx, khongLuuAnh);
    const cacDong = kq.lines.filter((l) => l.kind === 'para');
    const cuoi = cacDong[cacDong.length - 1]!;
    if (cuoi.kind !== 'para') throw new Error('phải là đoạn văn');
    expect(cuoi.text).toContain('$$');
  });

  it('cả tệp đi hết chuỗi và ra câu hỏi dùng được', async () => {
    const docx = await dungDocx(
      [
        doan(chu('Thư mục: Giải tích 12')),
        doan(chu('Câu 1. [TN1] Giá trị của ') + phanSo('1', '2') + chu(' bằng bao nhiêu?')),
        doan(chu('A. 0,5')),
        doan(chu('B. 0,25')),
        doan(chu('Đáp án: A')),
        doan(chu('Câu 2. [TLN] Tính ') + phanSo('8', '2') + chu('.')),
        doan(chu('Đáp án: 4')),
      ].join('')
    );

    const { lines } = await docDocx(docx, khongLuuAnh);
    const kq = parseQuestions(lines);

    expect(kq.loiChung).toEqual([]);
    expect(kq.questions).toHaveLength(2);

    const [c1, c2] = kq.questions;
    expect(c1!.loi).toEqual([]);
    expect(c1!.folder).toBe('Giải tích 12');
    expect(c1!.type).toBe('MULTIPLE_CHOICE_SINGLE');
    expect(c1!.options.map((o) => o.isCorrect)).toEqual([true, false]);
    expect(c1!.content).toContain('$');

    expect(c2!.loi).toEqual([]);
    expect(c2!.type).toBe('SHORT_ANSWER');
    expect(c2!.options.map((o) => o.content)).toEqual(['4']);
  });

  it('bảng trong tệp được giữ lại thành dòng bảng', async () => {
    const o = (t: string) => `<w:tc>${doan(chu(t))}</w:tc>`;
    const hang = (a: string, b: string) => `<w:tr>${o(a)}${o(b)}</w:tr>`;
    const docx = await dungDocx(
      [
        doan(chu('Câu 1. [TN1] Chọn đáp án đúng.')),
        `<w:tbl>${hang('A. một', 'B. hai')}${hang('C. ba', 'D. bốn')}</w:tbl>`,
        doan(chu('Đáp án: C')),
      ].join('')
    );

    const { lines } = await docDocx(docx, khongLuuAnh);
    expect(lines.some((l) => l.kind === 'table')).toBe(true);

    const c = parseQuestions(lines).questions[0]!;
    expect(c.options.map((o2) => o2.content)).toEqual(['một', 'hai', 'ba', 'bốn']);
    expect(c.options.map((o2) => o2.isCorrect)).toEqual([false, false, true, false]);
  });
});
