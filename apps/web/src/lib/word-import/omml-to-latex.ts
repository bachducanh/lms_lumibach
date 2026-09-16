import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import omml2mathml from 'omml2mathml';
import { MathMLToLaTeX } from 'mathml-to-latex';

/**
 * Đổi công thức Word thành mã LaTeX ngay trong tệp .docx.
 *
 * Vì sao phải làm trước khi đưa cho mammoth: mammoth BỎ QUA hoàn toàn công thức
 * của Office và không báo lỗi gì cả. Giáo viên gõ đề toán bằng Equation rồi nhập
 * vào sẽ thấy công thức biến mất sạch mà không hiểu vì sao.
 *
 * Cách làm: mở tệp như một kho nén, tìm mọi nút công thức trong thân tài liệu,
 * chuyển sang MathML rồi sang LaTeX, và THAY nút đó bằng một đoạn chữ thường
 * `$...$`. Sau bước này tệp vẫn là .docx hợp lệ, mammoth đọc như bình thường, và
 * công thức đi tiếp dưới đúng quy ước mà cả mẫu nhập lẫn bộ hiển thị đều hiểu.
 *
 * Chỉ chạy trên máy chủ: thư viện chuyển đổi cần bản DOM của Node.
 */

const NS_M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Các phần của tài liệu có thể chứa công thức. */
const PHAN_TAI_LIEU = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

export type KetQuaDoiCongThuc = {
  /** Tệp .docx đã thay công thức bằng chữ. */
  buffer: Buffer;
  /** Số công thức đổi được, và số công thức chịu thua. */
  daDoi: number;
  thatBai: number;
};

/**
 * Bộ chuyển OMML dựng MathML bằng bản DOM của riêng nó, không phải bản đang đọc
 * tệp. Ép nó qua serializer của xmldom là gặp lỗi khó hiểu, nên ưu tiên hỏi
 * chính phần tử đó trước.
 */
function thanhChuoi(node: unknown): string {
  const n = node as { outerHTML?: unknown };
  if (typeof n.outerHTML === 'string' && n.outerHTML) return n.outerHTML;
  return new XMLSerializer().serializeToString(node as never);
}

function latexTuOMath(node: Node): string | null {
  try {
    const mathml = omml2mathml(node as never);
    const latex = MathMLToLaTeX.convert(thanhChuoi(mathml)).trim();
    return latex || null;
  } catch (e) {
    if (process.env.DEBUG_OMML) console.error('[OMML]', e);
    return null;
  }
}

/**
 * Bọc LaTeX vào dấu đô la. Công thức đứng riêng một dòng (oMathPara) dùng hai
 * dấu, đúng quy ước của mẫu nhập đề.
 */
function bocDollar(latex: string, dungRieng: boolean): string {
  return dungRieng ? `$$${latex}$$` : `$${latex}$`;
}

export async function doiCongThucTrongDocx(input: ArrayBuffer): Promise<KetQuaDoiCongThuc> {
  const zip = await JSZip.loadAsync(input);
  let daDoi = 0;
  let thatBai = 0;

  for (const ten of Object.keys(zip.files)) {
    if (!PHAN_TAI_LIEU.test(ten)) continue;
    const xml = await zip.files[ten]!.async('string');
    if (!xml.includes('oMath')) continue;

    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    // Lấy hết một lượt rồi mới sửa: danh sách trực tiếp từ DOM sẽ co lại ngay
    // khi thay nút đầu tiên và vòng lặp bỏ sót già nửa số công thức.
    const cacNut: Element[] = [];
    const dsPara = doc.getElementsByTagNameNS(NS_M, 'oMathPara');
    for (let i = 0; i < dsPara.length; i++) cacNut.push(dsPara[i] as unknown as Element);
    const dsMath = doc.getElementsByTagNameNS(NS_M, 'oMath');
    for (let i = 0; i < dsMath.length; i++) {
      const nut = dsMath[i] as unknown as Element;
      // Bỏ qua công thức đã nằm trong một oMathPara vừa gom ở trên.
      if (cacNut.some((cha) => cha !== nut && cha.contains?.(nut))) continue;
      cacNut.push(nut);
    }

    for (const nut of cacNut) {
      const cha = nut.parentNode;
      if (!cha) continue;
      const dungRieng = nut.localName === 'oMathPara';
      const goc = dungRieng
        ? ((nut.getElementsByTagNameNS(NS_M, 'oMath')[0] as unknown as Node) ?? nut)
        : nut;
      const latex = latexTuOMath(goc);
      if (!latex) {
        thatBai++;
        continue;
      }

      // Một run chữ thường mang đúng chuỗi $...$; giữ khoảng trắng để LaTeX
      // không bị dính vào chữ bên cạnh.
      const run = doc.createElementNS(NS_W, 'w:r');
      const t = doc.createElementNS(NS_W, 'w:t');
      t.setAttribute('xml:space', 'preserve');
      t.appendChild(doc.createTextNode(` ${bocDollar(latex, dungRieng)} `));
      run.appendChild(t);
      cha.replaceChild(run as never, nut as never);
      daDoi++;
    }

    zip.file(ten, new XMLSerializer().serializeToString(doc as never));
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { buffer, daDoi, thatBai };
}
