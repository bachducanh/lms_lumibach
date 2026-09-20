import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Khung bao cho các trang công khai (giới thiệu, đăng nhập/đăng ký).
 *
 * - `theme-light`: luôn dùng bảng màu sáng, không đụng tới theme đã lưu của
 *   người dùng (dashboard vẫn theo lựa chọn sáng/tối của họ).
 * - `lb-marketing`: quy tắc kiểu chữ/focus riêng cho trang công khai (phông Exo 2 đã được
 *   nạp ở root layout).
 */
export function MarketingShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('theme-light lb-marketing min-h-screen', className)}>{children}</div>;
}
