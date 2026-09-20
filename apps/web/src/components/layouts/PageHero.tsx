import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Header tràn viền cho các trang nội dung khoá học (giáo trình, bài giảng, bài
 * tập, quiz, đề luyện tập, bài code).
 *
 * Tràn viền bằng margin âm đúng bằng padding của `<main>` trong layout
 * dashboard (`p-3 sm:p-4 md:p-6`). Lệch một nhịp là trang thừa ra vài pixel và
 * sinh thanh cuộn ngang, nên ba mốc này phải đi kèm nhau — sửa padding của
 * layout thì sửa cả ở đây.
 *
 * Dải màu trên đỉnh là dải đã dùng ở trang đăng nhập: nó nối trang công khai
 * với trang bên trong thành một hệ, và cắm mốc thị giác cho biết đây là đầu
 * một khu vực nội dung chứ không phải một thẻ trong danh sách.
 */
export function PageHero({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  /** Dải sát mép dưới (vd thanh tiến độ vị trí trong khoá) — nằm ngoài vùng đệm. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card relative -mx-3 -mt-3 mb-8 overflow-hidden border-b sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6',
        className
      )}
    >
      {/* Dải màu thương hiệu (giống trang đăng nhập) */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-1">
        <span className="bg-lb-pink-strong w-[22%]" />
        <span className="bg-lb-navy-deep w-[18%]" />
        <span className="bg-lb-cyan flex-1" />
        <span className="bg-lb-navy w-[20%]" />
      </div>

      {/* Lưới kỹ thuật mờ — gợi không khí phòng máy, đủ nhạt để không tranh
          chỗ với chữ. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="page-hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#page-hero-grid)" />
      </svg>

      {/* Hai quầng sáng thương hiệu */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: 'rgb(253 8 93 / 10%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl"
        style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
      />

      <div className="relative space-y-4 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      {footer && <div className="relative">{footer}</div>}
    </div>
  );
}
