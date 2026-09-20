'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/register', label: 'Đăng ký' },
  { href: '/login', label: 'Đăng nhập' },
] as const;

/**
 * Hai tab nối trang đăng ký với trang đăng nhập.
 *
 * Chúng là hai trang riêng (mỗi trang một địa chỉ, tự render trên máy chủ) chứ
 * không phải hai panel của một widget, nên tab ở đây là <Link> — bấm là đổi
 * trang thật, quay lại được bằng nút Back và gửi link được cho học sinh.
 *
 * Chỉ hiện ở đúng hai trang đó: quên mật khẩu, đặt lại mật khẩu hay xác thực
 * email không phải một lựa chọn song song với chúng.
 */
export function AuthTabs() {
  const pathname = usePathname();
  const active = TABS.find((t) => t.href === pathname);
  if (!active) return null;

  return (
    <nav aria-label="Đăng ký hoặc đăng nhập" className="w-full max-w-md">
      <ul className="border-border flex gap-6 border-b">
        {TABS.map((tab) => {
          const isActive = tab.href === active.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-block border-b-2 px-1 pb-3 text-base transition-colors',
                  isActive
                    ? 'border-primary text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
