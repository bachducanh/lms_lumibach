import { MathText } from '@/components/ui/editor/MathText';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { optionIsRich } from '@/lib/rich-options';
import { cn } from '@/lib/utils';

type Props = {
  /** Loại câu hỏi — quyết định nội dung là HTML hay chữ thuần. */
  type: string;
  content: string;
  className?: string;
};

/**
 * Nội dung của một phương án, dựng đúng theo loại câu hỏi.
 *
 * Trắc nghiệm và phát biểu Đúng/Sai soạn bằng trình soạn thảo nên là HTML; các
 * loại còn lại là chữ thuần, có thể lẫn công thức `$...$`. Đưa chữ thuần vào
 * RichTextView là mất ký tự `<`, còn đưa HTML vào MathText là hiện nguyên thẻ.
 */
export function OptionContent({ type, content, className }: Props) {
  if (optionIsRich(type)) {
    // rich-inherit: phương án nằm trong nút chọn nên phải ăn màu của nút (đã
    // chọn thì màu chính, sai thì đỏ) thay vì màu chữ mặc định của nội dung.
    return <RichTextView html={content} className={cn('rich-inherit min-w-0', className)} />;
  }
  return <MathText text={content} className={className} />;
}
