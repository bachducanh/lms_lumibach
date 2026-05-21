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

/** Hiển thị nội dung rich-text (read-only) với cùng kiểu prose như RichTextEditor. */
export function RichTextView({ html, className }: Props) {
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
