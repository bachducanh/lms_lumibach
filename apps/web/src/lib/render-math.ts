import katex from 'katex';

/**
 * Dựng công thức toán trong nội dung rich-text.
 *
 * Extension Mathematics của TipTap lưu MÃ LATEX NGUỒN trong thuộc tính, không
 * lưu HTML mà KaTeX sinh ra:
 *
 *   <span data-type="inline-math" data-latex="\frac{a}{b}"></span>
 *   <div  data-type="block-math"  data-latex="\int_0^1 f(x)dx"></div>
 *
 * Giữ nguồn như vậy để giáo viên sửa lại công thức được, và để nội dung lưu
 * trong DB không phình lên vì hàng trăm thẻ span của KaTeX. Đổi lại, mọi nơi
 * CHỈ hiển thị (RichTextView) phải tự dựng — đó là việc của hàm này.
 *
 * Chạy được cả trên máy chủ lẫn trình duyệt nên không cần biến trang thành
 * client component chỉ để hiện công thức.
 */

// Bắt cả thẻ, kể cả khi thứ tự thuộc tính đổi. Node công thức luôn rỗng ruột,
// nhưng vẫn nuốt phần giữa để lần dựng thứ hai không lồng KaTeX vào KaTeX.
const MATH_NODE_RE =
  /<(span|div)\b([^>]*\bdata-type="(?:inline|block)-math"[^>]*)>[\s\S]*?<\/\1>/gi;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // luôn cuối cùng, nếu không "&amp;lt;" ra sai
}

function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMathInHtml(html: string): string {
  // Lối tắt cho phần lớn nội dung: không có công thức thì không đụng chuỗi.
  if (!html) return html;
  if (!html.includes('-math"') && !html.includes('$')) return html;

  return renderDollarMath(html).replace(MATH_NODE_RE, (whole, tag: string, attrs: string) => {
    const found = /\bdata-latex="([^"]*)"/i.exec(attrs);
    if (!found) return whole;

    const latex = decodeEntities(found[1] ?? '');
    const isBlock = /\bdata-type="block-math"/i.test(attrs);
    try {
      // throwOnError: false → công thức gõ sai hiện chữ đỏ tại chỗ thay vì làm
      // sập cả trang đề. Giữ lại data-latex để nội dung này quay về trình soạn
      // thảo vẫn sửa được.
      const rendered = katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
      });
      const type = isBlock ? 'block-math' : 'inline-math';
      return `<${tag} data-type="${type}" data-latex="${escapeAttr(latex)}">${rendered}</${tag}>`;
    } catch {
      return whole;
    }
  });
}

// Thẻ mở/đóng, hoặc một mảng chữ nằm giữa các thẻ.
const TAG_OR_TEXT = /<[^>]+>|[^<]+/g;
// Bên trong những thẻ này, dấu đô la là dấu đô la thật (biến shell, chuỗi định
// dạng, PHP…) chứ không phải công thức.
const SKIP_TAGS = /^<\s*(\/?)\s*(pre|code|script|style)\b/i;

/**
 * Dựng công thức viết theo lối `$...$` nằm lẫn trong chữ của HTML.
 *
 * Cần đến vì giáo viên gõ `$...$` thẳng trong trình soạn thảo mà quy tắc tự đổi
 * của TipTap không phải lúc nào cũng bắt được — đề dán từ nơi khác vào thì chắc
 * chắn không bắt. Không có bước này thì công thức nằm im dưới dạng chữ thô.
 */
function renderDollarMath(html: string): string {
  if (!html.includes('$')) return html;

  let skipDepth = 0;
  return html.replace(TAG_OR_TEXT, (chunk) => {
    if (chunk.startsWith('<')) {
      const tag = SKIP_TAGS.exec(chunk);
      if (tag) {
        if (tag[1]) skipDepth = Math.max(0, skipDepth - 1);
        else if (!chunk.endsWith('/>')) skipDepth++;
      }
      return chunk;
    }
    if (skipDepth > 0 || !chunk.includes('$')) return chunk;

    // Chữ ở đây đã được escape sẵn, nên giữ nguyên phần ngoài công thức và chỉ
    // giải mã phần LaTeX trước khi đưa cho KaTeX.
    const parts: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TEXT_MATH_RE.lastIndex = 0;
    while ((m = TEXT_MATH_RE.exec(chunk)) !== null) {
      parts.push(chunk.slice(last, m.index));
      const isBlock = m[1] !== undefined;
      const latex = decodeEntities((isBlock ? m[1] : m[2]) ?? '');
      try {
        parts.push(katex.renderToString(latex, { displayMode: isBlock, throwOnError: false }));
      } catch {
        parts.push(m[0]);
      }
      last = m.index + m[0].length;
    }
    parts.push(chunk.slice(last));
    return parts.join('');
  });
}

// ── Công thức trong chuỗi chữ thuần ───────────────────────────
//
// Phương án A/B/C/D, các mục sắp xếp, hai vế ghép nối… đều nhập bằng ô chữ
// thuần chứ không phải trình soạn thảo, nên không mang được node công thức.
// Với đề toán thì chính các phương án mới hay là công thức, vì vậy ở đây chấp
// nhận quy ước quen thuộc: $...$ cho công thức giữa dòng, $$...$$ cho công thức
// đứng riêng. Cùng quy ước với mẫu nhập đề từ Word.

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// $$...$$ xét trước $...$. Công thức giữa dòng không cho xuống dòng, để một dấu
// đô la lạc lõng không nuốt cả đoạn phía sau.
const TEXT_MATH_RE = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

export function renderMathInText(raw: string): string {
  if (!raw) return '';
  if (!raw.includes('$')) return escapeHtml(raw);

  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TEXT_MATH_RE.lastIndex = 0;
  while ((m = TEXT_MATH_RE.exec(raw)) !== null) {
    parts.push(escapeHtml(raw.slice(last, m.index)));
    const isBlock = m[1] !== undefined;
    const latex = (isBlock ? m[1] : m[2]) ?? '';
    try {
      parts.push(katex.renderToString(latex, { displayMode: isBlock, throwOnError: false }));
    } catch {
      // Công thức hỏng nặng thì trả lại đúng chữ giáo viên đã gõ, không nuốt mất.
      parts.push(escapeHtml(m[0]));
    }
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join('');
}
