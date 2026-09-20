'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string };

/**
 * Menu thu gọn cho màn hình nhỏ. Đóng khi chọn một mục hoặc nhấn Escape.
 * Các liên kết #mục nằm cùng trang nên phải tự đóng, nếu không panel che mất nội dung.
 */
export function MobileNav({ links, isLoggedIn }: { links: NavLink[]; isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        className="text-foreground hover:bg-muted flex h-10 w-10 items-center justify-center rounded-lg"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="border-border bg-background absolute top-full right-0 left-0 border-b shadow-lg"
        >
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3" aria-label="Điều hướng chính">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-foreground hover:bg-muted rounded-lg px-3 py-3 text-base font-medium"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t pt-3">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-11 flex-1 rounded-full font-semibold'
                  )}
                >
                  Vào Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'lg' }),
                      'h-11 flex-1 rounded-full font-semibold'
                    )}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: 'lg' }),
                      'h-11 flex-1 rounded-full font-semibold'
                    )}
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
