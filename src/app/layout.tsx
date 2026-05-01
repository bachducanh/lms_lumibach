import type { Metadata } from 'next';
import { Exo_2, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const exo2 = Exo_2({
  variable: '--font-exo2',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${exo2.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider defaultTheme="dark">
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
