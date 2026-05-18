import Link from 'next/link';
import { Search } from 'lucide-react';

export const metadata = { title: '404 — Không tìm thấy' };

export default function NotFound() {
  return (
    <div className="bg-background relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'rgb(253 8 93 / 12%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'oklch(0.78 0.16 250 / 0.10)' }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Search className="text-primary h-8 w-8" />
        </div>
        <p className="text-primary mb-2 text-xs font-bold tracking-[0.25em] uppercase">LumiBach</p>
        <h1 className="text-foreground font-mono text-7xl font-black tracking-tight md:text-8xl">
          404
        </h1>
        <p className="text-foreground mt-4 max-w-md text-lg font-semibold">
          Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
        </p>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          Hãy kiểm tra lại đường dẫn, hoặc quay về tổng quan để tiếp tục học.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:brightness-110"
            style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 30%)' }}
          >
            Về Tổng quan
          </Link>
          <Link
            href="/courses"
            className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Xem khoá học
          </Link>
        </div>
      </div>
    </div>
  );
}
