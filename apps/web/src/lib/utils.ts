import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gỡ toàn bộ thẻ HTML, trả về text thuần (dùng cho preview dạng 1 dòng). */
export function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kiểm tra nội dung rich-text có rỗng không (bỏ qua thẻ rỗng như <p></p>). */
export function richTextIsEmpty(html: string): boolean {
  if (!html) return true;
  if (/<(img|iframe|video|table|hr)\b/i.test(html)) return false;
  return stripHtml(html) === '';
}

/**
 * Đưa nội dung về HTML để render bằng RichTextView.
 *
 * Bài diễn đàn cũ lưu văn bản thô (trước khi diễn đàn dùng rich text) — nếu
 * đổ thẳng vào innerHTML thì mất hết xuống dòng và ký tự `<` sẽ bị nuốt. Chuỗi
 * nào không có thẻ HTML thì escape rồi chuyển xuống dòng thành <br>.
 */
export function toRichHtml(content: string): string {
  if (!content) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;
  const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
