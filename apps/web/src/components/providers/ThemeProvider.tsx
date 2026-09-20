'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({
  children,
  defaultTheme = 'light',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [ready, setReady] = useState(false);

  // Đọc localStorage sau khi mount (tránh hydration mismatch). Script trong
  // <head> (layout.tsx) đã gắn sẵn class `dark` trước khi vẽ nên không bị nháy.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') setThemeState(saved);
    } catch {
      // localStorage bị chặn — dùng theme mặc định.
    }
    setReady(true);
  }, []);

  // Apply class lên <html>. Chờ `ready` để không gỡ class `dark` do script <head> đặt
  // trước khi kịp đọc lựa chọn đã lưu.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, ready]);

  // Chỉ ghi localStorage khi người dùng chủ động đổi theme.
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // bỏ qua
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
