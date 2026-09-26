import type {
  DocLine,
  DocPara,
  ParsedOption,
  ParsedQuestion,
  ParsedTestCase,
  ParseResult,
} from './types';

/**
 * Biến một tài liệu Word đã tách dòng thành danh sách câu hỏi.
 *
 * Quy tắc của mẫu, gọn lại còn ba mốc cắt:
 *   - `Câu <số>.` mở một câu mới
 *   - `A.` đến `H.` mở một mục
 *   - một nhãn trong danh sách cố định mở một khối
 * Mọi đoạn khác NỐI vào khối ngay trước nó. Nhờ vậy công thức đứng riêng dòng,
 * đề bài nhiều đoạn, hay đoạn mã nhiều dòng đều không cần cú pháp riêng.
 *
 * Hàm này thuần: không đụng DOM, không đụng mạng, nên kiểm thử được thẳng.
 */

// ── Chuẩn hoá chữ ────────────────────────────────────────────────

/** Bỏ dấu tiếng Việt + hạ chữ thường, để so nhãn không phụ thuộc cách gõ. */
function chuanHoa(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const THE_HTML = /<[^>]+>/g;

/**
 * Bóc thẻ, đổi thực thể cơ bản. Dùng cho khối mã nguồn và các ô chữ thuần.
 *
 * Ranh giới đoạn văn thành dấu xuống dòng: ô bảng test gõ hai dòng trong Word là
 * hai đoạn `<p>`, bóc thẻ trơn thì "3" và "1 5 3" dính thành "31 5 3".
 */
function sangChuThuan(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre)>\s*(?=\S)/gi, '\n')
    .replace(THE_HTML, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Giữ nguyên HTML của từng đoạn ────────────────────────────────
//
// `text` của một đoạn là chữ ĐÃ GIẢI MÃ: "Thẻ &lt;p&gt;" trong HTML thành
// "Thẻ <p>" trong text. Chỉ được dùng text để dò nhãn và mốc, tuyệt đối không
// ghép nó lại vào HTML — làm thế thì đề bài về HTML biến thẻ trong đề thành thẻ
// thật, còn in đậm, xuống dòng mềm và ảnh ở dòng đầu thì mất sạch.

const THUC_THE = /^&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/i;
const THUC_THE_CACH = /^&(nbsp|#160|#xa0);$/i;

/** Số ký tự hiển thị không tính khoảng trắng — đơn vị để khớp text với HTML. */
function demKyTu(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Bỏ `soKyTu` ký tự hiển thị (không tính khoảng trắng) ở đầu một đoạn HTML,
 * cùng khoảng trắng liền sau, mà vẫn giữ mọi thẻ. Dùng để cắt "Câu 3. [TN1]",
 * "Giải thích:" hay "A." khỏi đoạn văn mà không đụng tới định dạng phía sau.
 *
 * Đếm theo ký tự không phải khoảng trắng vì `text` đã được gộp khoảng trắng còn
 * HTML thì chưa; phần chữ còn lại thì hai bên luôn khớp nhau từng ký tự.
 */
export function catDauHtml(html: string, soKyTu: number): string {
  let conLai = soKyTu;
  let i = 0;
  let giu = '';
  while (i < html.length) {
    const c = html[i]!;
    if (c === '<') {
      const het = html.indexOf('>', i);
      if (het < 0) break;
      giu += html.slice(i, het + 1);
      i = het + 1;
      continue;
    }
    let doDai = 1;
    // \s của JavaScript đã gồm cả dấu cách không ngắt (U+00A0).
    let laCach = /\s/.test(c);
    if (c === '&') {
      const m = THUC_THE.exec(html.slice(i));
      if (m) {
        doDai = m[0].length;
        laCach = THUC_THE_CACH.test(m[0]);
      }
    }
    if (!laCach) {
      if (conLai === 0) break;
      conLai--;
    }
    i += doDai;
  }
  // Thẻ định dạng bọc đúng phần tiền tố (hay gặp: "Câu 1." in đậm) giờ rỗng ruột.
  return (giu + html.slice(i)).replace(
    /<(strong|b|em|i|u|s|code|sup|sub|span)\b[^>]*>\s*<\/\1>/gi,
    ''
  );
}

/**
 * Giữ khoảng trắng mà HTML sẽ gộp mất: tab, thụt lề đầu dòng và các chuỗi nhiều
 * dấu cách. Đoạn mã gõ bằng phông thường trong đề bài nhờ vậy vẫn thẳng hàng.
 */
function giuKhoangTrang(html: string): string {
  let dauDong = true;
  return html.replace(/<[^>]+>|[^<]+/g, (manh) => {
    if (manh.startsWith('<')) {
      if (/^<br\b/i.test(manh)) dauDong = true;
      return manh;
    }
    let s = manh.replace(/\t/g, '    ');
    if (dauDong) {
      s = s.replace(/^ +/, (m) => '&nbsp;'.repeat(m.length));
      if (manh.trim() !== '') dauDong = false;
    }
    return s.replace(/ {2,}/g, (m) => '&nbsp;'.repeat(m.length));
  });
}

/**
 * Một mảnh của phần rich-text (đề bài, giải thích, phương án): hoặc một đoạn
 * HTML, hoặc một dòng mã. Các dòng mã liền nhau được gom thành một khối `<pre>`.
 */
type Manh =
  | { code: false; html: string }
  /** `trongDong`: phần mã nằm ngay sau "A." — đứng một mình thì hiện mã trong dòng. */
  | { code: true; dong: string; trongDong?: boolean };

/** Ký hiệu mà dòng lệnh gần như luôn có, còn câu văn thì hầu như không. */
const KY_HIEU_MA = /[(){}[\]<>=;#"'`]|::|->/;

/**
 * Dòng gõ phông đều nét nhưng thật ra là câu văn: có chữ có dấu mà không có ký
 * hiệu lệnh nào. Hay gặp nhất là dòng gõ ngay sau đoạn mã vừa dán — Enter xong
 * Word giữ luôn phông Consolas — kiểu "Kết quả in ra là gì?". Không có bước này
 * thì câu hỏi bị nuốt vào khối mã.
 */
function laVanXuoi(text: string): boolean {
  return /[À-ỹ]/.test(text) && !KY_HIEU_MA.test(text);
}

function manhDoan(html: string): Manh {
  // Ô bảng lấy nguyên cả ô thì đã có sẵn thẻ khối, bọc thêm <p> là lồng sai.
  if (/<(p|ul|ol|table|h[1-6]|pre|blockquote|div)\b/i.test(html)) return { code: false, html };
  // Chỉ cắt khoảng trắng cuối: khoảng trắng đầu đoạn là thụt lề, phải giữ.
  return { code: false, html: `<p>${giuKhoangTrang(html.replace(/\s+$/, ''))}</p>` };
}

function manhCode(html: string, trongDong = false): Manh {
  return { code: true, dong: chuanHoaCode(sangChuThuan(html)).replace(/\s+$/, ''), trongDong };
}

function dungHtml(manhs: Manh[]): string {
  const ra: string[] = [];
  let code: Extract<Manh, { code: true }>[] = [];
  const dongKhoiMa = () => {
    if (code.length === 0) return;
    // "A. cout << x;" gõ Consolas: một dòng mã ngắn làm phương án thì hiện như
    // mã trong dòng, bọc cả khối <pre> cho nó thì nặng nề.
    const [dau] = code;
    if (code.length === 1 && dau?.trongDong) {
      ra.push(`<p><code>${escapeHtml(dau.dong.trim())}</code></p>`);
    } else {
      ra.push(`<pre><code>${escapeHtml(code.map((c) => c.dong).join('\n'))}</code></pre>`);
    }
    code = [];
  };
  for (const m of manhs) {
    if (m.code) {
      code.push(m);
    } else {
      dongKhoiMa();
      ra.push(m.html);
    }
  }
  dongKhoiMa();
  return ra.join('');
}

/**
 * Gỡ những thứ Word tự ý sửa trong đoạn mã.
 *
 * Nhìn trên giấy thì không thấy gì lạ, nhưng dán vào trình chấm là chương trình
 * chết: nháy cong không phải nháy thẳng, mũi tên một ký tự không phải toán tử
 * truy cập con trỏ của C++, gạch dài không phải hai dấu trừ.
 *
 * CHỈ gọi cho khối mã. Trong đề bài văn xuôi thì nháy cong mới là đúng.
 */
export function chuanHoaCode(raw: string): string {
  return raw
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[–—]/g, '--')
    .replace(/−/g, '-')
    .replace(/\u00a0/g, ' ');
}

// ── Bảng tra ─────────────────────────────────────────────────────

const MA_LOAI: Record<string, string> = {
  tn1: 'MULTIPLE_CHOICE_SINGLE',
  'trac nghiem 1 dap an': 'MULTIPLE_CHOICE_SINGLE',
  'trac nghiem mot dap an': 'MULTIPLE_CHOICE_SINGLE',
  tnn: 'MULTIPLE_CHOICE_MULTIPLE',
  'trac nghiem nhieu dap an': 'MULTIPLE_CHOICE_MULTIPLE',
  ds: 'TRUE_FALSE',
  'dung sai': 'TRUE_FALSE',
  dsn: 'TRUE_FALSE_MULTI',
  'dung sai nhieu y': 'TRUE_FALSE_MULTI',
  tl: 'ESSAY',
  'tu luan': 'ESSAY',
  tln: 'SHORT_ANSWER',
  'tra loi ngan': 'SHORT_ANSWER',
  sx: 'ORDERING',
  'sap xep': 'ORDERING',
  gn: 'MATCHING',
  'ghep noi': 'MATCHING',
  parsons: 'PARSONS',
  'sap xep dong lenh': 'PARSONS',
  dk: 'CODE_FILL',
  'dien khuyet': 'CODE_FILL',
  'dien vao cho trong': 'CODE_FILL',
  py: 'CODE_PYTHON',
  python: 'CODE_PYTHON',
  cpp: 'CODE_CPP',
  'c++': 'CODE_CPP',
  fix_py: 'CODE_DEBUG_PYTHON',
  'sua loi python': 'CODE_DEBUG_PYTHON',
  fix_cpp: 'CODE_DEBUG_CPP',
  'sua loi c++': 'CODE_DEBUG_CPP',
  web: 'CODE_WEB',
  'lap trinh web': 'CODE_WEB',
};

type TenKhoi =
  | 'de'
  | 'dapAn'
  | 'giaiThich'
  | 'diem'
  | 'codeMau'
  | 'dapAnCode'
  | 'test'
  | 'thoiGian'
  | 'boNho'
  | 'thuMuc';

/** Xét theo thứ tự: "dap an code" phải đứng trước "dap an". */
const NHAN: { khoa: string; khoi: TenKhoi }[] = [
  { khoa: 'dap an code', khoi: 'dapAnCode' },
  { khoa: 'dap an', khoi: 'dapAn' },
  { khoa: 'giai thich', khoi: 'giaiThich' },
  { khoa: 'thu muc', khoi: 'thuMuc' },
  { khoa: 'code mau', khoi: 'codeMau' },
  { khoa: 'thoi gian', khoi: 'thoiGian' },
  { khoa: 'bo nho', khoi: 'boNho' },
  { khoa: 'diem', khoi: 'diem' },
  { khoa: 'test', khoi: 'test' },
  { khoa: 'de', khoi: 'de' },
];

const LOAI_CO_MUC = new Set([
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE_MULTI',
  'ORDERING',
  'MATCHING',
]);

const LOAI_CODE = new Set([
  'CODE_PYTHON',
  'CODE_CPP',
  'CODE_DEBUG_PYTHON',
  'CODE_DEBUG_CPP',
  'CODE_WEB',
  'PARSONS',
  'CODE_FILL',
]);

const LOAI_CAN_TEST = new Set(['CODE_PYTHON', 'CODE_CPP', 'CODE_DEBUG_PYTHON', 'CODE_DEBUG_CPP']);

// ── Nhận dạng dòng ───────────────────────────────────────────────

const RE_CAU = /^\s*c[âa]u\s*(\d+)\s*[.:)]?\s*(.*)$/i;
const RE_MA_LOAI = /^\s*\[([^\]]{1,40})\]\s*/;
// Phần sau "A." được phép trống: phương án là cả đoạn mã nhiều dòng thì người
// soạn để "A." một dòng riêng rồi dán mã xuống dưới.
const RE_MUC = /^\s*([A-Ha-h])\s*[.):](?:\s+(.*))?$/;

/**
 * Dòng code dùng biến tên `cau1` — `cau1 = [1, 2]`, `cau1.append(3)` — chứ không
 * phải "Câu 1". Tên biến không có dấu cách, nên chỉ cần xét lúc "câu" dính liền
 * con số: còn là mốc câu hỏi khi theo sau là dấu chấm/hai chấm/ngoặc rồi khoảng
 * trắng, mã loại trong ngoặc vuông, hay chữ hoa mở đầu đề bài.
 */
function laBienTenCau(text: string): boolean {
  const m = /^\s*c[âa]u\d+(.*)$/i.exec(text);
  if (!m) return false;
  return !/^(\s*[.:)](\s|$)|\s+\[|\s+\p{Lu}|\s*$)/u.test(m[1] ?? '');
}

function khopCau(text: string): RegExpExecArray | null {
  return laBienTenCau(text) ? null : RE_CAU.exec(text);
}

/** Dòng nhãn dạng `Tên: phần còn lại`. Trả null nếu không phải nhãn đã biết. */
function doNhan(text: string): { khoi: TenKhoi; tienTo: string; phanConLai: string } | null {
  const vt = text.indexOf(':');
  if (vt < 0 || vt > 24) return null;
  const ten = chuanHoa(text.slice(0, vt));
  for (const { khoa, khoi } of NHAN) {
    if (ten === khoa) {
      return { khoi, tienTo: text.slice(0, vt + 1), phanConLai: text.slice(vt + 1).trim() };
    }
  }
  return null;
}

/** Dòng mở câu, mở mục hay là một nhãn — tức là một mốc cắt của mẫu. */
function laMoc(text: string): boolean {
  return khopCau(text) !== null || RE_MUC.test(text) || doNhan(text) !== null;
}

/** Dựng lại bảng Word thành bảng HTML mà trình soạn thảo đọc được. */
function dungBang(rows: string[][]): string {
  const o = (html: string) =>
    /<(p|ul|ol|table|pre)\b/i.test(html) ? html : `<p>${html.trim()}</p>`;
  const hang = rows.map((r) => `<tr>${r.map((c) => `<td>${o(c)}</td>`).join('')}</tr>`);
  return `<table><tbody>${hang.join('')}</tbody></table>`;
}

const RE_DOAN_TRONG_O = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;

function docParaTuHtml(html: string, thuocTinh = ''): DocPara {
  return {
    kind: 'para',
    html,
    text: sangChuThuan(html).replace(/\s+/g, ' ').trim(),
    isListItem: false,
    isCode: /\bclass="[^"]*\blb-code\b/.test(thuocTinh),
  };
}

/**
 * Tách một ô bảng thành từng đoạn. Một ô hay chứa nhiều đoạn — hai phương án
 * xếp chồng trong một ô, hay phương án kèm một dòng mã — và mỗi đoạn phải được
 * xét mốc riêng như ngoài bảng.
 */
function tachDoanTrongO(o: string): DocPara[] {
  const ra: DocPara[] = [];
  const ngoaiDoan = o.replace(RE_DOAN_TRONG_O, (_all, thuocTinh: string, trong: string) => {
    ra.push(docParaTuHtml(trong, thuocTinh));
    return '';
  });
  // Còn chữ hay ảnh nằm ngoài mọi đoạn (danh sách, ô gõ tay) thì lấy cả ô cho
  // chắc, thà thừa định dạng còn hơn mất nội dung.
  if (ra.length === 0 || sangChuThuan(ngoaiDoan).trim() !== '' || /<img/i.test(ngoaiDoan)) {
    return [docParaTuHtml(o)];
  }
  return ra;
}

function doSo(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Câu đang dựng ────────────────────────────────────────────────

/** `manh` dựng phương án rich-text, `text` cho các loại so khớp chữ thuần. */
type Muc = { manh: Manh[]; text: string };

type Dang = {
  nhan: string;
  maLoaiTho: string | null;
  /** Dòng "Câu N." gõ bằng phông đều nét thì cả câu không dựa vào phông để
   *  đoán đâu là mã được — tệp mẫu cũ và nhiều người gõ cả đề bằng Consolas. */
  cauLaCode: boolean;
  de: Manh[];
  mucs: Muc[];
  dapAn: string;
  giaiThich: Manh[];
  diem: string;
  codeMau: string[];
  dapAnCode: string[];
  test: ParsedTestCase[];
  thoiGian: string;
  boNho: string;
  folder: string | null;
  /** Khối đang mở, để biết đoạn kế tiếp nối vào đâu. */
  khoi: TenKhoi | 'muc';
};

function dangMoi(
  nhan: string,
  maLoaiTho: string | null,
  folder: string | null,
  cauLaCode: boolean
): Dang {
  return {
    nhan,
    maLoaiTho,
    cauLaCode,
    de: [],
    mucs: [],
    dapAn: '',
    giaiThich: [],
    diem: '',
    codeMau: [],
    dapAnCode: [],
    test: [],
    thoiGian: '',
    boNho: '',
    folder,
    khoi: 'de',
  };
}

// ── Dựng đáp án theo từng loại ───────────────────────────────────

function chuCaiSangChiSo(raw: string): number {
  return raw.trim().toUpperCase().charCodeAt(0) - 65;
}

/** `Đ`/`S` và vài cách viết quen thuộc. */
function laDung(raw: string): boolean | null {
  const t = chuanHoa(raw);
  if (['d', 'dung', 'true', 'dg', 'x'].includes(t)) return true;
  if (['s', 'sai', 'false', 'f'].includes(t)) return false;
  return null;
}

/** Loại không có phương án nào: tự luận và các câu code chấm bằng test. */
const LOAI_KHONG_CO_MUC = new Set([
  'ESSAY',
  'CODE_PYTHON',
  'CODE_CPP',
  'CODE_WEB',
  'CODE_DEBUG_PYTHON',
  'CODE_DEBUG_CPP',
]);

/** HTML của một phương án; báo lỗi nếu trống — "A." đứng riêng mà quên dán mã. */
function noiDungMuc(m: Muc, i: number, loi: string[]): string {
  const html = dungHtml(m.manh);
  if (!html) loi.push(`Phương án ${String.fromCharCode(65 + i)} không có nội dung.`);
  return html;
}

function dungOptions(d: Dang, loai: string, loi: string[]): ParsedOption[] {
  if (LOAI_KHONG_CO_MUC.has(loai)) return [];

  const mucs = d.mucs;
  const dapAn = d.dapAn.trim();

  if (loai === 'TRUE_FALSE') {
    const v = laDung(dapAn);
    if (v === null) {
      loi.push('Câu Đúng/Sai cần dòng "Đáp án:" ghi Đ hoặc S.');
      return [];
    }
    // Hai lựa chọn là cố định, giống hệt lúc soạn tay trong ứng dụng.
    return [
      { content: 'Đúng', isCorrect: v },
      { content: 'Sai', isCorrect: !v },
    ];
  }

  if (loai === 'SHORT_ANSWER') {
    // Các cách viết ngăn bởi dấu gạch đứng; nếu không có thì lấy luôn các mục.
    const tuDapAn = dapAn
      ? dapAn
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : mucs.map((m) => m.text.trim()).filter(Boolean);
    if (tuDapAn.length === 0) loi.push('Câu trả lời ngắn cần ít nhất một đáp án.');
    return tuDapAn.map((content) => ({ content, isCorrect: true }));
  }

  if (loai === 'CODE_FILL') {
    const gt = dapAn
      ? dapAn
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : mucs.map((m) => m.text.trim()).filter(Boolean);
    if (gt.length === 0) loi.push('Câu điền khuyết cần dòng "Đáp án:" cho từng chỗ trống.');
    return gt.map((content) => ({ content, isCorrect: true }));
  }

  if (loai === 'PARSONS') {
    // Dòng lệnh lấy từ khối mã, không liệt kê bằng A./B. — cách đó rất dễ mất
    // thụt lề, mà với Python thì thụt lề là cú pháp.
    const dong = layCodeMau(d).split('\n');
    const sach = dong.filter((l) => l.trim() !== '');
    if (sach.length < 2) loi.push('Câu Parsons cần khối "Code mẫu:" có từ 2 dòng trở lên.');
    return sach.map((content) => ({ content, isCorrect: true }));
  }

  if (loai === 'MATCHING') {
    if (mucs.length < 2) loi.push('Câu ghép nối cần ít nhất 2 cặp.');
    return mucs.map((m) => {
      const [trai, phai] = m.text.split('|');
      const l = (trai ?? '').trim();
      const r = (phai ?? '').trim();
      if (!l || !r) loi.push(`Cặp ghép nối "${m.text.trim()}" thiếu một vế.`);
      return { content: JSON.stringify({ left: l, right: r }), isCorrect: true };
    });
  }

  if (loai === 'ORDERING') {
    if (mucs.length < 2) loi.push('Câu sắp xếp cần ít nhất 2 mục.');
    return mucs.map((m) => ({ content: m.text.trim(), isCorrect: true }));
  }

  if (loai === 'TRUE_FALSE_MULTI') {
    const cacY = dapAn
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (mucs.length < 2) loi.push('Câu Đúng/Sai nhiều ý cần ít nhất 2 phát biểu.');
    if (cacY.length !== mucs.length) {
      loi.push(`Dòng "Đáp án:" có ${cacY.length} giá trị nhưng câu có ${mucs.length} phát biểu.`);
    }
    return mucs.map((m, i) => ({
      content: noiDungMuc(m, i, loi),
      isCorrect: laDung(cacY[i] ?? '') === true,
    }));
  }

  // Trắc nghiệm một hoặc nhiều đáp án.
  const chiSoDung = new Set(
    dapAn
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^[A-Ha-h]$/.test(s))
      .map(chuCaiSangChiSo)
  );
  if (mucs.length < 2) loi.push('Câu trắc nghiệm cần ít nhất 2 phương án.');
  if (chiSoDung.size === 0) loi.push('Thiếu dòng "Đáp án:" hoặc đáp án không phải chữ cái A-H.');
  for (const i of chiSoDung) {
    if (i < 0 || i >= mucs.length) {
      loi.push(`Đáp án trỏ tới phương án ${String.fromCharCode(65 + i)} nhưng câu không có.`);
    }
  }
  if (loai === 'MULTIPLE_CHOICE_SINGLE' && chiSoDung.size > 1) {
    loi.push('Trắc nghiệm một đáp án nhưng dòng "Đáp án:" ghi nhiều chữ cái.');
  }
  return mucs.map((m, i) => ({ content: noiDungMuc(m, i, loi), isCorrect: chiSoDung.has(i) }));
}

function layCodeMau(d: Dang): string {
  return chuanHoaCode(d.codeMau.join('\n')).replace(/\s+$/, '');
}

// ── Bảng test case ───────────────────────────────────────────────

const TEN_COT_VAO = ['dau vao', 'input', 'vao'];
const TEN_COT_RA = ['ket qua', 'ket qua mong doi', 'output', 'ra', 'ket qua mong muon'];
const TEN_COT_AN = ['an', 'hidden', 'cho hoc sinh xem'];
const TEN_COT_DIEM = ['diem', 'points', 'point'];

function docBangTest(rows: string[][]): ParsedTestCase[] {
  if (rows.length === 0) return [];

  // Hàng đầu là tiêu đề nếu ô đầu trùng một tên cột đã biết.
  const dau = (rows[0] ?? []).map((c) => chuanHoa(sangChuThuan(c)));
  const coTieuDe = dau.some((c) => TEN_COT_VAO.includes(c));
  let iVao = 0;
  let iRa = 1;
  let iAn = -1;
  let iDiem = -1;
  if (coTieuDe) {
    dau.forEach((ten, i) => {
      if (TEN_COT_VAO.includes(ten)) iVao = i;
      else if (TEN_COT_RA.includes(ten)) iRa = i;
      else if (TEN_COT_AN.includes(ten)) iAn = i;
      else if (TEN_COT_DIEM.includes(ten)) iDiem = i;
    });
  }

  const than = coTieuDe ? rows.slice(1) : rows;
  const ra: ParsedTestCase[] = [];
  for (const row of than) {
    const oVao = sangChuThuan(row[iVao] ?? '').trim();
    const oRa = sangChuThuan(row[iRa] ?? '').trim();
    if (!oVao && !oRa) continue;
    const oAn = iAn >= 0 ? chuanHoa(sangChuThuan(row[iAn] ?? '')) : '';
    ra.push({
      input: oVao,
      expectedOutput: oRa,
      isHidden: oAn !== '' && oAn !== 'khong' && oAn !== 'x0',
      points: (iDiem >= 0 ? doSo(sangChuThuan(row[iDiem] ?? '')) : null) ?? 1,
    });
  }
  return ra;
}

/** Dạng viết gọn một dòng: `5 => 25`, kèm `[ẩn]` và `[2đ]` tuỳ chọn. */
const RE_TEST_MOT_DONG = /^(.*?)=>(.*)$/;

function docTestMotDong(raw: string): ParsedTestCase | null {
  const m = RE_TEST_MOT_DONG.exec(raw);
  if (!m) return null;
  let phanRa = (m[2] ?? '').trim();
  let isHidden = false;
  let points = 1;

  phanRa = phanRa.replace(/\[\s*([^\]]*)\s*\]/g, (_all, trong: string) => {
    const t = chuanHoa(trong);
    if (t === 'an' || t === 'hidden') isHidden = true;
    const diem = /^([\d.,]+)\s*d?$/.exec(t);
    if (diem) points = doSo(diem[1] ?? '') ?? 1;
    return '';
  });

  return {
    input: (m[1] ?? '').trim(),
    expectedOutput: phanRa.trim(),
    isHidden,
    points,
  };
}

// ── Chốt một câu ─────────────────────────────────────────────────

function chot(d: Dang): ParsedQuestion {
  const loi: string[] = [];
  const canhBao: string[] = [];

  const maTho = (d.maLoaiTho ?? '').trim();
  const loai = maTho ? MA_LOAI[chuanHoa(maTho)] : 'MULTIPLE_CHOICE_SINGLE';
  if (!loai) {
    loi.push(`Không hiểu mã loại "${maTho}".`);
  }
  const loaiThat = loai ?? 'MULTIPLE_CHOICE_SINGLE';

  const content = dungHtml(d.de);
  if (!content) loi.push('Câu này không có đề bài.');

  const options = loi.length > 0 && !loai ? [] : dungOptions(d, loaiThat, loi);

  if (LOAI_CO_MUC.has(loaiThat) && d.mucs.length === 0) {
    loi.push('Loại câu này cần các mục A., B., C.');
  }

  const codeMau = layCodeMau(d);
  if (loaiThat === 'CODE_FILL' && !codeMau.includes('___')) {
    loi.push('Câu điền khuyết cần khối "Code mẫu:" có ít nhất một chỗ trống ___.');
  }
  if (loaiThat === 'CODE_FILL' && codeMau.split('___').length - 1 !== options.length) {
    loi.push(
      `Số chỗ trống (${codeMau.split('___').length - 1}) không khớp số đáp án (${options.length}).`
    );
  }
  if (LOAI_CAN_TEST.has(loaiThat) && d.test.length === 0) {
    loi.push('Câu lập trình cần khối "Test:" để chấm tự động.');
  }

  const diem = doSo(d.diem) ?? 1;
  if (d.diem.trim() && doSo(d.diem) === null) {
    canhBao.push(`Không đọc được điểm "${d.diem.trim()}", tạm lấy 1.`);
  }

  const laCode = LOAI_CODE.has(loaiThat);
  const canGioiHan = LOAI_CAN_TEST.has(loaiThat);
  const dapAnCode = chuanHoaCode(d.dapAnCode.join('\n')).replace(/\s+$/, '');

  return {
    type: loaiThat,
    content,
    explanation: d.giaiThich.length > 0 ? dungHtml(d.giaiThich) : null,
    points: diem,
    folder: d.folder,
    // Parsons dựng mục từ khối mã nên không giữ lại khối đó nữa.
    options,
    testCases: canGioiHan ? d.test : [],
    starterCode: laCode && loaiThat !== 'PARSONS' && codeMau ? codeMau : null,
    solutionCode: canGioiHan && dapAnCode ? dapAnCode : null,
    timeLimit: canGioiHan ? (doSo(d.thoiGian) ?? 3) : null,
    memoryLimit: canGioiHan ? (doSo(d.boNho) ?? 256) * 1024 : null,
    nhan: d.nhan,
    loi,
    canhBao,
  };
}

// ── Bộ phân tích ─────────────────────────────────────────────────

export function parseQuestions(lines: DocLine[]): ParseResult {
  const questions: ParsedQuestion[] = [];
  const loiChung: string[] = [];

  let folder: string | null = null;
  let dang: Dang | null = null;

  const dongLai = () => {
    if (dang) questions.push(chot(dang));
    dang = null;
  };

  // Đọc qua hàm: `dang` được gán bên trong closure phía dưới nên trình kiểm kiểu
  // không lần được luồng, và ở vòng lặp chính nó tưởng biến luôn rỗng.
  const layDang = (): Dang | null => dang;

  /** Xử lý một đoạn văn — dùng lại cho cả ô bảng khi trải phẳng. */
  const xuLyDoan = (para: DocPara) => {
    const text = para.text.trim();
    if (!text && !/<img/i.test(para.html)) return;

    /** HTML của đoạn sau khi bỏ phần chữ `tienTo` ở đầu (tiền tố lấy từ `text`). */
    const htmlSau = (tienTo: string) => catDauHtml(para.html, demKyTu(tienTo));
    const coNoiDung = (html: string) => sangChuThuan(html).trim() !== '' || /<img/i.test(html);

    // Đoạn gõ phông đều nét trong một câu gõ phông thường — tức là mã dán vào.
    const laMa = para.isCode === true && dang !== null && !dang.cauLaCode;

    // 1. Mốc "Câu N."
    const mCau = khopCau(text);
    if (mCau) {
      dongLai();
      let conLai = mCau[2] ?? '';
      let maLoai: string | null = null;
      const mMa = RE_MA_LOAI.exec(conLai);
      if (mMa) {
        maLoai = mMa[1] ?? null;
        conLai = conLai.slice(mMa[0].length);
      }
      dang = dangMoi(`Câu ${mCau[1]}`, maLoai, folder, para.isCode === true);
      const phanDe = htmlSau(text.slice(0, text.length - conLai.length));
      if (coNoiDung(phanDe)) dang.de.push(manhDoan(phanDe));
      return;
    }

    // 2. Nhãn
    const nhan = doNhan(text);
    if (nhan) {
      if (nhan.khoi === 'thuMuc') {
        // Áp cho các câu PHÍA SAU. Câu đang mở giữ nguyên thư mục lúc nó bắt
        // đầu — khai lại giữa chừng là dấu hiệu chuyển sang cụm câu mới, không
        // phải sửa lại chỗ đứng của câu vừa viết xong.
        folder = nhan.phanConLai || null;
        return;
      }
      if (!dang) {
        loiChung.push(`Nhãn "${text.slice(0, 30)}" nằm ngoài mọi câu hỏi nên bị bỏ qua.`);
        return;
      }
      dang.khoi = nhan.khoi;
      const v = nhan.phanConLai;
      const vHtml = htmlSau(nhan.tienTo);
      switch (nhan.khoi) {
        case 'de':
          if (coNoiDung(vHtml)) dang.de.push(manhDoan(vHtml));
          break;
        case 'dapAn':
          dang.dapAn = v;
          break;
        case 'giaiThich':
          if (coNoiDung(vHtml)) dang.giaiThich.push(manhDoan(vHtml));
          break;
        case 'diem':
          dang.diem = v;
          break;
        case 'thoiGian':
          dang.thoiGian = v;
          break;
        case 'boNho':
          dang.boNho = v;
          break;
        // Mã lấy từ HTML chứ không từ `v`: `text` đã gộp các dấu cách liền nhau.
        case 'codeMau':
          if (v) dang.codeMau.push(sangChuThuan(vHtml));
          break;
        case 'dapAnCode':
          if (v) dang.dapAnCode.push(sangChuThuan(vHtml));
          break;
        case 'test': {
          const t = v ? docTestMotDong(v) : null;
          if (t) dang.test.push(t);
          break;
        }
      }
      return;
    }

    // 3. Mục A. đến H., hoặc một mục của danh sách tự đánh số
    if (dang) {
      const mMuc = RE_MUC.exec(text);
      if (mMuc) {
        const conLai = mMuc[2] ?? '';
        const phan = htmlSau(text.slice(0, text.length - conLai.length));
        // "A." đứng riêng: nội dung phương án nằm ở các đoạn phía dưới.
        const manh: Manh[] = !conLai.trim()
          ? []
          : laMa && KY_HIEU_MA.test(conLai)
            ? [manhCode(phan, true)]
            : [manhDoan(phan)];
        dang.mucs.push({ manh, text: conLai });
        dang.khoi = 'muc';
        return;
      }
      // Word đánh số tự động: chữ cái nằm ở định dạng chứ không ở văn bản. Chỉ
      // nhận khi câu đã có đề bài, để không nuốt nhầm danh sách trong đề.
      if (para.isListItem && dang.de.length > 0 && dang.khoi !== 'codeMau') {
        dang.mucs.push({ manh: [manhDoan(para.html)], text });
        dang.khoi = 'muc';
        return;
      }
    }

    // 4. Không phải mốc nào → nối vào khối đang mở
    if (!dang) return;
    // Đoạn mã dán vào đề phải giữ nguyên dòng và thụt lề trong một khối <pre>
    // — trừ câu văn bị Word giữ phông Consolas sau khi dán mã.
    const manh = laMa && !laVanXuoi(text) ? manhCode(para.html) : manhDoan(para.html);
    switch (dang.khoi) {
      case 'muc': {
        const cuoi = dang.mucs[dang.mucs.length - 1];
        if (cuoi) {
          cuoi.manh.push(manh);
          cuoi.text = `${cuoi.text} ${text}`.trim();
        }
        break;
      }
      case 'giaiThich':
        dang.giaiThich.push(manh);
        break;
      case 'codeMau':
        dang.codeMau.push(sangChuThuan(para.html));
        break;
      case 'dapAnCode':
        dang.dapAnCode.push(sangChuThuan(para.html));
        break;
      case 'test': {
        const t = docTestMotDong(text);
        if (t) dang.test.push(t);
        break;
      }
      case 'dapAn':
        dang.dapAn = `${dang.dapAn} ${text}`.trim();
        break;
      default:
        dang.de.push(manh);
    }
  };

  for (const line of lines) {
    if (line.kind === 'para') {
      xuLyDoan(line);
      continue;
    }

    // Bảng ngay dưới nhãn Test là bảng test case.
    const hienTai = layDang();
    if (hienTai && hienTai.khoi === 'test') {
      hienTai.test.push(...docBangTest(line.rows));
      continue;
    }

    // Bảng có chứa mốc (Câu, A., nhãn) là cách trình bày cho gọn giấy — rất hay
    // gặp: bốn phương án xếp hai cột — nên trải phẳng theo thứ tự đọc rồi xử lý
    // từng ô như một đoạn. Bảng không có mốc nào là bảng dữ liệu của đề (bảng
    // HocSinh của câu CSDL, bảng giá trị…): trải phẳng thì mỗi ô thành một dòng,
    // nên giữ nguyên là bảng.
    const cacO = line.rows.map((row) => row.map(tachDoanTrongO));
    const coMoc = cacO.some((row) => row.some((o) => o.some((d) => laMoc(d.text))));
    if (!coMoc && hienTai && hienTai.khoi !== 'codeMau' && hienTai.khoi !== 'dapAnCode') {
      const bang: Manh = { code: false, html: dungBang(line.rows) };
      const cuoi = hienTai.mucs[hienTai.mucs.length - 1];
      if (hienTai.khoi === 'muc' && cuoi) cuoi.manh.push(bang);
      else if (hienTai.khoi === 'giaiThich') hienTai.giaiThich.push(bang);
      else hienTai.de.push(bang);
      continue;
    }
    for (const row of cacO) {
      for (const o of row) {
        for (const doan of o) xuLyDoan(doan);
      }
    }
  }
  dongLai();

  if (questions.length === 0) {
    loiChung.push('Không tìm thấy câu hỏi nào. Mỗi câu phải mở đầu bằng "Câu 1.", "Câu 2."…');
  }
  return { questions, loiChung };
}
