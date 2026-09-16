import mammoth from 'mammoth';
import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import { doiCongThucTrongDocx } from './omml-to-latex';
import type { DocLine } from './types';

/**
 * Đọc một tệp .docx thành danh sách dòng cho bộ phân tích mẫu.
 *
 * Chạy trên máy chủ. Ba việc, theo đúng thứ tự:
 *   1. Đổi công thức Office thành `$...$` ngay trong tệp (mammoth bỏ qua chúng).
 *   2. mammoth chuyển sang HTML, ảnh được đẩy lên kho tệp và thay bằng đường dẫn.
 *   3. Trải HTML thành đoạn văn và bảng, giữ lại cờ "đoạn này là mục của danh
 *      sách tự đánh số" — Word đánh số A/B/C bằng định dạng chứ không bằng chữ,
 *      nên không có cờ này thì mọi phương án trình bày kiểu đó đều biến mất.
 */

export type KetQuaDocDocx = {
  lines: DocLine[];
  congThucDaDoi: number;
  congThucThatBai: number;
  anhDaLuu: number;
  anhLoi: number;
};

/** Hàm lưu một ảnh và trả về đường dẫn công khai. */
export type LuuAnh = (data: Buffer, contentType: string) => Promise<string>;

const KIEU_ANH_CHO_PHEP: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
};

function layText(el: HTMLElement): string {
  // node-html-parser giữ nguyên thực thể; decode để bộ phân tích so nhãn đúng.
  return el.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Đoạn có ảnh nhưng không có chữ vẫn phải giữ lại. */
function coNoiDung(el: HTMLElement): boolean {
  return layText(el) !== '' || el.querySelector('img') !== null;
}

function duyetKhoi(nodes: HTMLElement[], trongDanhSach: boolean, ra: DocLine[]): void {
  for (const el of nodes) {
    const ten = el.rawTagName?.toLowerCase();
    if (!ten) continue;

    if (ten === 'table') {
      const rows: string[][] = [];
      for (const tr of el.querySelectorAll('tr')) {
        rows.push(tr.querySelectorAll('td, th').map((o) => o.innerHTML));
      }
      if (rows.length > 0) ra.push({ kind: 'table', rows });
      continue;
    }

    if (ten === 'ul' || ten === 'ol') {
      duyetKhoi(el.childNodes.filter(laPhanTu), true, ra);
      continue;
    }

    if (ten === 'li') {
      // Mục danh sách có thể chứa đoạn con; gom chữ của cả mục làm một dòng.
      if (coNoiDung(el)) {
        ra.push({ kind: 'para', html: el.innerHTML, text: layText(el), isListItem: true });
      }
      // Danh sách lồng bên trong mục vẫn phải được đi tiếp.
      duyetKhoi(el.querySelectorAll('ul, ol'), true, ra);
      continue;
    }

    if (/^(p|h[1-6]|div|blockquote|pre)$/.test(ten)) {
      if (coNoiDung(el)) {
        ra.push({
          kind: 'para',
          html: el.innerHTML,
          text: layText(el),
          isListItem: trongDanhSach,
        });
      }
      continue;
    }

    // Thẻ bọc không rõ nghĩa: đi xuống con của nó.
    duyetKhoi(el.childNodes.filter(laPhanTu), trongDanhSach, ra);
  }
}

function laPhanTu(n: unknown): n is HTMLElement {
  return typeof (n as HTMLElement)?.rawTagName === 'string';
}

export async function docDocx(input: ArrayBuffer, luuAnh: LuuAnh): Promise<KetQuaDocDocx> {
  const { buffer, daDoi, thatBai } = await doiCongThucTrongDocx(input);

  let anhDaLuu = 0;
  let anhLoi = 0;

  const ketQua = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const contentType = image.contentType ?? '';
        if (!KIEU_ANH_CHO_PHEP[contentType]) {
          anhLoi++;
          return { src: '' };
        }
        try {
          const base64 = await image.read('base64');
          const url = await luuAnh(Buffer.from(base64, 'base64'), contentType);
          anhDaLuu++;
          return { src: url };
        } catch {
          // Một ảnh hỏng không được làm đổ cả tệp đề; bỏ ảnh đó và báo số lượng.
          anhLoi++;
          return { src: '' };
        }
      }),
    }
  );

  const goc = parseHtml(ketQua.value, { blockTextElements: { pre: true } });
  const lines: DocLine[] = [];
  duyetKhoi(goc.childNodes.filter(laPhanTu), false, lines);

  return {
    lines,
    congThucDaDoi: daDoi,
    congThucThatBai: thatBai,
    anhDaLuu,
    anhLoi,
  };
}
