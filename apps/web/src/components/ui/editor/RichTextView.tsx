import { cn } from '@/lib/utils';

// Lớp phòng thủ XSS cho nội dung rich-text (do giáo viên soạn qua RichTextEditor).
// Gỡ script/style, thuộc tính sự kiện on*, và href/src dạng javascript:.
function sanitizeHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

type Props = {
  html: string;
  className?: string;
};

/**
 * Hiển thị nội dung rich-text (read-only).
 *
 * Class `rich-content` gắn vào cùng bộ CSS với `.ProseMirror` trong globals.css,
 * nên bảng, ảnh, căn lề… hiện giống hệt lúc soạn và giống trang bài tập.
 */
export function RichTextView({ html, className }: Props) {
  return (
    <div
      className={cn('rich-content max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
