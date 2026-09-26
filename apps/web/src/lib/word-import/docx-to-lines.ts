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

// ── Nhận ra mã nguồn qua phông chữ ───────────────────────────────
//
// Mã dán từ VS Code, Dev-C++ hay trình duyệt sang Word mang theo phông đều nét.
// Đó là dấu hiệu duy nhất đáng tin để phân biệt một dòng `<h1>Xin chào</h1>` là
// mã cần giữ nguyên với một câu văn. mammoth không tự làm việc này nên ta đánh
// dấu trước khi nó dựng HTML: cả đoạn đều nét thì gắn class cho đoạn, còn vài
// chữ đều nét lẫn trong câu thì bọc <code>.

const PHONG_DEU_NET =
  /^(consolas|courier|courier new|lucida console|lucida sans typewriter|cascadia (code|mono)|menlo|monaco|sf mono|source code pro|jetbrains mono|fira (code|mono)|roboto mono|ubuntu mono|dejavu sans mono|liberation mono|noto sans mono|inconsolata)$/i;
/** Kiểu đoạn dựng sẵn của Word cho mã: "HTML Preformatted", "Plain Text"… */
const KIEU_DOAN_MA = /(code|preformatted|plain text|source)/i;

const KIEU_DOAN_CODE = 'LumiBach Code Paragraph';
const KIEU_CHU_CODE = 'LumiBach Code Run';

const STYLE_MAP = [
  `p[style-name='${KIEU_DOAN_CODE}'] => p.lb-code:fresh`,
  `r[style-name='${KIEU_CHU_CODE}'] => code`,
  // mammoth mặc định bỏ gạch chân; trình soạn thảo của ta thì có.
  'u => u',
];

type PhanTuDocx = {
  type: string;
  children?: PhanTuDocx[];
  value?: string;
  font?: string | null;
  styleName?: string | null;
  styleId?: string | null;
  numbering?: unknown;
};

function chuCuaRun(run: PhanTuDocx): string {
  let s = '';
  for (const c of run.children ?? []) {
    if (c.type === 'text') s += c.value ?? '';
  }
  return s;
}

function cacRun(el: PhanTuDocx, ra: PhanTuDocx[] = []): PhanTuDocx[] {
  for (const c of el.children ?? []) {
    if (c.type === 'run') ra.push(c);
    else cacRun(c, ra);
  }
  return ra;
}

function danhDauDoan(doan: PhanTuDocx): PhanTuDocx {
  // Chỉ run có chữ mới tính: dấu tab, xuống dòng hay khoảng trắng thường mang
  // phông mặc định dù người gõ đã chọn Consolas cho cả dòng.
  const coChu = cacRun(doan).filter((r) => chuCuaRun(r).trim() !== '');
  // Phông đặt thẳng trên chữ, hoặc kiểu chữ dựng sẵn "HTML Code" của Word.
  const laMa = (r: PhanTuDocx) =>
    (!!r.font && PHONG_DEU_NET.test(r.font.trim())) ||
    (!!r.styleName && KIEU_DOAN_MA.test(r.styleName));

  const caDoan =
    !doan.numbering &&
    ((!!doan.styleName && KIEU_DOAN_MA.test(doan.styleName)) ||
      (coChu.length > 0 && coChu.every(laMa)));
  if (caDoan) return { ...doan, styleId: null, styleName: KIEU_DOAN_CODE };

  for (const r of coChu) {
    if (laMa(r)) r.styleName = KIEU_CHU_CODE;
  }
  return doan;
}

function danhDauMa(el: PhanTuDocx): PhanTuDocx {
  if (el.type === 'paragraph') return danhDauDoan(el);
  if (el.children) el.children = el.children.map(danhDauMa);
  return el;
}

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
          isCode: ten === 'pre' || el.classList.contains('lb-code'),
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
      styleMap: STYLE_MAP,
      transformDocument: danhDauMa,
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
