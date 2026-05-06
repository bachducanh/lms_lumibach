import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { buttonVariants } from '@/components/ui/button';
import { BookOpen, FlaskConical, GraduationCap, ArrowRight, Sparkles, Zap, Terminal, Code2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tổng quan',
};

const QUICK_LINKS = [
  {
    href: '/courses',
    icon: BookOpen,
    label: 'Khoá học',
    description: 'Xem và quản lý khoá học',
    color: 'text-primary',
    bg: 'bg-primary/10',
    glow: 'rgb(253 8 93 / 25%)',
    border: 'hover:border-primary/40',
  },
  {
    href: '/sandbox',
    icon: FlaskConical,
    label: 'Sandbox',
    description: 'Thực hành lập trình tự do',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    glow: 'oklch(0.80 0.13 210 / 0.25)',
    border: 'hover:border-cyan-400/40',
  },
  {
    href: '/students',
    icon: GraduationCap,
    label: 'Học sinh',
    description: 'Quản lý danh sách học sinh',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    glow: 'oklch(0.70 0.18 140 / 0.25)',
    border: 'hover:border-emerald-400/40',
    roles: ['ADMIN', 'TEACHER', 'TA'],
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  const role = user?.role ?? '';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const visibleLinks = QUICK_LINKS.filter(
    (l) => !l.roles || l.roles.includes(role),
  );

  return (
    <div className="space-y-8">

      {/* ── Welcome hero — Unity dark + orange glow ─────────── */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        {/* Tech grid background */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="unity-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#unity-grid)" />
        </svg>

        {/* Orange glow blob — top right */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'rgb(253 8 93 / 15%)' }}
        />
        {/* Cyan glow blob — bottom left */}
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'oklch(0.80 0.13 210 / 0.08)' }}
        />

        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #fd085d, oklch(0.80 0.13 210 / 0.5), transparent)' }}
        />

        <div className="relative p-8">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              {/* Label */}
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" style={{ filter: 'drop-shadow(0 0 6px #fd085d)' }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                  LumiBach Learning
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                {greeting},{' '}
                <span className="text-primary" style={{ textShadow: '0 0 20px rgb(253 8 93 / 50%)' }}>
                  {user?.name?.split(' ').at(-1) ?? user?.email?.split('@')[0] ?? 'bạn'}
                </span>
                !
              </h1>

              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Chào mừng trở lại. Tiếp tục hành trình học lập trình và công nghệ thông tin của bạn.
              </p>

              {/* Tech badges */}
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tracking-wide">
                  <Terminal className="h-2.5 w-2.5" /> Tin học
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 tracking-wide">
                  <Code2 className="h-2.5 w-2.5" /> Lập trình
                </span>
              </div>
            </div>

            <Link
              href="/courses"
              className="shrink-0 hidden sm:flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
              style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 40%)' }}
            >
              Xem khoá học
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick links ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Truy cập nhanh
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 unity-card-hover ${link.border}`}
              >
                {/* Icon box */}
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${link.bg} transition-all duration-200 group-hover:scale-110`}
                  style={{ boxShadow: `0 0 12px ${link.glow}` }}
                >
                  <Icon className={`h-5 w-5 ${link.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm transition-colors duration-150 group-hover:${link.color}`}>
                    {link.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                </div>

                <ArrowRight className={`h-4 w-4 text-muted-foreground/30 transition-all duration-200 group-hover:${link.color} group-hover:translate-x-0.5 shrink-0`} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Stats placeholder — Unity terminal style ─────────── */}
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-8 py-10 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
        <div className="relative flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground/50 font-mono tracking-wide">
            // Thống kê &amp; widgets đang được phát triển
          </p>
        </div>
      </div>
    </div>
  );
}
