import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { vnHour } from '@/lib/datetime';
import { BookOpen, FlaskConical, GraduationCap, ArrowRight, Sparkles, Code2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tổng quan',
};

// Màu ô biểu tượng lấy từ bảng màu thương hiệu; `dark:` để vẫn đọc được ở theme tối.
const QUICK_LINKS = [
  {
    href: '/courses',
    icon: BookOpen,
    label: 'Khoá học',
    description: 'Xem và quản lý khoá học',
    tone: 'bg-primary/10 text-primary',
  },
  {
    href: '/sandbox',
    icon: FlaskConical,
    label: 'Sandbox',
    description: 'Thực hành lập trình tự do',
    tone: 'bg-lb-cyan/15 text-lb-navy dark:text-lb-cyan',
  },
  {
    href: '/students',
    icon: GraduationCap,
    label: 'Học sinh',
    description: 'Quản lý danh sách học sinh',
    tone: 'bg-lb-navy/10 text-lb-navy dark:bg-white/10 dark:text-white',
    roles: ['ADMIN', 'TEACHER', 'TA'],
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  const role = user?.role ?? '';

  // Giờ Việt Nam, không phải giờ tiến trình: trang này render trên server và
  // container chạy UTC, nên `new Date().getHours()` chào "buổi sáng" suốt cả
  // buổi chiều.
  const greeting = (() => {
    const h = vnHour();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const visibleLinks = QUICK_LINKS.filter((l) => !l.roles || l.roles.includes(role));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
      {/* ── Welcome ─────────────────────────────────────────── */}
      <section className="border-border bg-card relative overflow-hidden rounded-xl border shadow-sm">
        <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:p-10">
          <div className="space-y-4">
            <p className="text-primary text-sm font-bold">LumiBach Learning</p>

            <h1 className="font-heading text-3xl leading-tight font-bold text-balance sm:text-4xl">
              {greeting},{' '}
              <span className="text-primary">
                {user?.name?.split(' ').at(-1) ?? user?.email?.split('@')[0] ?? 'bạn'}
              </span>
              !
            </h1>

            <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty">
              Chào mừng trở lại. Tiếp tục hành trình học lập trình và công nghệ thông tin của bạn.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="border-border text-foreground bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                <Code2 className="text-primary h-3.5 w-3.5" aria-hidden /> Tin học
              </span>
              <span className="border-border text-foreground bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                <Sparkles className="text-primary h-3.5 w-3.5" aria-hidden /> Lập trình
              </span>
            </div>

            <div className="pt-2">
              <Link
                href="/courses"
                className="bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors hover:bg-[#b80043]"
              >
                Xem khoá học
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Hình nhấn thương hiệu: hai mảng màu + ký hiệu code */}
          <div className="relative mx-auto hidden h-44 w-56 lg:block" aria-hidden>
            <div className="bg-lb-pink absolute top-0 right-0 h-32 w-40 rounded-xl" />
            <div className="bg-lb-cyan absolute bottom-0 left-0 h-24 w-32 rounded-xl" />
            <div className="bg-lb-navy-deep font-display absolute inset-6 flex items-center justify-center rounded-xl text-4xl font-bold text-white shadow-md">
              {'</>'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Truy cập nhanh ──────────────────────────────────── */}
      <section aria-labelledby="quick-links-heading">
        <h2
          id="quick-links-heading"
          className="font-heading text-foreground mb-4 text-2xl font-bold"
        >
          Truy cập nhanh
        </h2>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href} className="flex">
                <Link
                  href={link.href}
                  className="group border-border bg-card flex w-full items-center gap-4 rounded-xl border p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_4px_18px_rgb(11_31_54_/_14%)]"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${link.tone}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block text-base font-semibold">
                      {link.label}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-sm">
                      {link.description}
                    </span>
                  </span>

                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Thống kê (đang phát triển) ──────────────────────── */}
      <section className="border-border bg-card/50 flex flex-col items-center gap-2 rounded-xl border border-dashed px-8 py-10 text-center">
        <Sparkles className="text-muted-foreground h-5 w-5" aria-hidden />
        <p className="text-muted-foreground text-sm font-medium">
          Thống kê &amp; widgets đang được phát triển
        </p>
      </section>
    </div>
  );
}
