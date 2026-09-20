import type { Metadata } from 'next';
import { Exo_2, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import './globals.css';

// Exo 2 cho toàn bộ chữ (cả tiếng Việt lẫn tiếng Anh). Phải nạp đủ subset `vietnamese`
// và `latin-ext`, nếu không các dấu tiếng Việt (ạ, ầ, ữ, đ…) rơi về phông dự phòng.
// Đây là phông biến thiên nên một file cho mọi độ đậm 100–900.
const exo2 = Exo_2({
  variable: '--font-exo2',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'LumiBach',
    template: '%s | LumiBach',
  },
  description: 'Hệ thống quản lý học tập LumiBach',
};

// Chạy trước khi trình duyệt vẽ: nếu người dùng đã chọn tối thì gắn class `dark`
// ngay, tránh nháy sáng rồi mới tối. Mặc định (chưa chọn gì) là sáng.
const themeInitScript = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${exo2.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="light">
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
