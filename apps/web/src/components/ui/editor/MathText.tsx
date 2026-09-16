import { renderMathInText } from '@/lib/render-math';

type Props = {
  /** Chữ thuần do giáo viên gõ; công thức đặt giữa $...$ hoặc $$...$$. */
  text: string;
  className?: string;
};

/**
 * Hiển thị một chuỗi chữ thuần có lẫn công thức toán.
 *
 * Dùng cho phương án trả lời, mục sắp xếp, vế ghép nối — những chỗ nhập bằng ô
 * chữ thường nên không mang được node công thức của trình soạn thảo. Chữ được
 * escape trước khi ghép, chỉ phần KaTeX là HTML.
 */
export function MathText({ text, className }: Props) {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: renderMathInText(text) }} />
  );
}
