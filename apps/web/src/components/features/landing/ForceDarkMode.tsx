'use client';

import { useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

/**
 * Landing page chỉ hỗ trợ dark mode — ép theme về dark khi mount, tránh
 * trường hợp theme "light" còn lưu từ dashboard rò rỉ sang đây.
 */
export function ForceDarkMode() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme !== 'dark') {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  return null;
}
