import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Brain,
  Cat,
  CheckCircle2,
  Terminal,
  FileText,
  Sparkles,
  ChevronRight,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { CountUp } from '@/components/features/landing/CountUp';
import { MouseGlow } from '@/components/features/landing/MouseGlow';
import { ParallaxBlob } from '@/components/features/landing/ParallaxBlob';
import { NebulaBackground } from '@/components/features/landing/NebulaBackground';
import { TiltCard } from '@/components/features/landing/TiltCard';
import { Magnetic } from '@/components/features/landing/Magnetic';
import { Typewriter } from '@/components/features/landing/Typewriter';
import { FaqAccordion } from '@/components/features/landing/FaqAccordion';
import { ScrollProgress } from '@/components/features/landing/ScrollProgress';

export const metadata = {
  title: 'LumiBach — Chuyển đổi ước mơ bằng mã nguồn thực tế',
  description:
    'Nền tảng giáo dục lập trình toàn diện cho thế hệ tiếp theo. Khơi nguồn cảm hứng, kiến tạo tư duy thuật toán, hiện thực hoá ý tưởng qua từng dòng code.',
};

export const dynamic = 'force-dynamic';
// touched to force Turbopack recompile — scroll-reveal landing

const FEATURES: {
  icon: typeof BookOpen;
  title: string;
  body: string;
  color: string;
}[] = [
  {
    icon: BookOpen,
    title: 'Giáo trình có cấu trúc',
    body: 'Tổ chức nội dung theo chương — bài giảng, bài tập, quiz, project — dẫn dắt học sinh đi từ nền tảng đến nâng cao theo lộ trình rõ ràng.',
    color: 'text-rose-400 bg-rose-500/10',
  },
  {
    icon: Code2,
    title: 'Chấm code tức thời',
    body: 'Học sinh viết Python, C++ hoặc Web ngay trong trình duyệt; hệ thống tự kiểm thử qua test case, trả kết quả trong vài giây.',
    color: 'text-cyan-400 bg-cyan-500/10',
  },
  {
    icon: Brain,
    title: 'Ngân hàng câu hỏi đa dạng',
    body: 'Mười hai dạng câu hỏi — từ trắc nghiệm, tự luận đến Parsons, Debug, điền chỗ trống — đo lường tư duy ở mọi cấp độ Bloom.',
    color: 'text-violet-400 bg-violet-500/10',
  },
  {
    icon: Cat,
    title: 'Lập trình kéo–thả Scratch',
    body: 'Trình soạn thảo Scratch nhúng trực tiếp giúp học sinh nhỏ tuổi tiếp cận tư duy lập trình mà không cần rời nền tảng.',
    color: 'text-orange-400 bg-orange-500/10',
  },
  {
    icon: FileText,
    title: 'Đánh giá & rubric',
    body: 'Chấm điểm theo rubric tuỳ biến, tổng hợp tự động vào sổ điểm, xuất báo cáo tiến độ chuyên nghiệp cho phụ huynh và nhà trường.',
    color: 'text-emerald-400 bg-emerald-500/10',
  },
  {
    icon: Sparkles,
    title: 'Phân tích & theo dõi thời gian thực',
    body: 'Dashboard trực quan cho phép giáo viên nắm bắt mức độ tham gia, phát hiện học sinh gặp khó khăn và can thiệp đúng lúc.',
    color: 'text-amber-400 bg-amber-500/10',
  },
];

const ROADMAP: { stage: string; title: string; items: string[] }[] = [
  {
    stage: 'Bước 1',
    title: 'Thiết kế khoá học',
    items: ['Khởi tạo lớp học', 'Xây dựng chương & lộ trình', 'Mời đồng nghiệp & trợ giảng'],
  },
  {
    stage: 'Bước 2',
    title: 'Soạn nội dung học liệu',
    items: [
      'Bài giảng đa phương tiện',
      'Bài tập & quiz',
      'Bài thực hành chấm tự động',
      'Project Scratch',
    ],
  },
  {
    stage: 'Bước 3',
    title: 'Kết nối học sinh',
    items: ['Mã tham gia lớp', 'Import danh sách từ Excel', 'Gửi lời mời cá nhân'],
  },
  {
    stage: 'Bước 4',
    title: 'Đánh giá & phản hồi',
    items: ['Sổ điểm tự động', 'Chấm rubric chi tiết', 'Báo cáo & xuất dữ liệu'],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Nền tảng phù hợp với những lứa tuổi nào?',
    a: 'Từ học sinh tiểu học (lập trình kéo–thả Scratch) đến THPT (Python, C++, Web). Nội dung tổ chức theo chương nên dễ điều chỉnh theo trình độ lớp.',
  },
  {
    q: 'Bài code được chấm như thế nào?',
    a: 'Học sinh viết code ngay trong trình duyệt; hệ thống chạy qua bộ test case và trả kết quả tự động trong vài giây, kèm điểm theo từng test.',
  },
  {
    q: 'Một giáo viên quản lý được bao nhiêu học sinh?',
    a: 'Nền tảng vận hành tốt với quy mô vài trăm học sinh mỗi giáo viên, hỗ trợ nhập danh sách từ Excel và mã tham gia lớp để ghi danh nhanh.',
  },
  {
    q: 'Có cần cài đặt gì không?',
    a: 'Không. Mọi thứ chạy trên trình duyệt — giáo viên và học sinh chỉ cần đăng nhập là dùng được ngay.',
  },
];

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Public stats — only counts, never PII
  const [userCount, courseCount, lessonCount] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.course.count({ where: { deletedAt: null, status: 'PUBLISHED' } }).catch(() => 0),
    prisma.moduleItem.count({ where: { type: 'LESSON' } }).catch(() => 0),
  ]);

  return (
    <div className="relative min-h-screen">
      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* Global nebula background — portaled to <body> (xem component) */}
      <NebulaBackground />

      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-lg">
              <Image src="/icon.png" alt="LumiBach" width={20} height={20} className="rounded" />
            </div>
            <span className="text-base font-bold tracking-tight">LumiBach</span>
            <span className="text-muted-foreground hidden text-[10px] font-semibold tracking-[0.2em] uppercase sm:inline">
              Learn
            </span>
          </Link>

          <nav className="text-muted-foreground hidden items-center gap-5 text-sm font-medium md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">
              Tính năng
            </a>
            <a href="#roadmap" className="hover:text-foreground transition-colors">
              Quy trình
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLoggedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Đăng nhập
                </Link>
                <Link href="/register" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
                  Bắt đầu
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Mouse-tracking spotlight (drives cursor glow) */}
        <MouseGlow />

        {/* Parallax glow accents — drift with scroll */}
        <ParallaxBlob
          speed={0.18}
          className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'rgb(253 8 93 / 12%)' }}
        />
        <ParallaxBlob
          speed={-0.12}
          className="pointer-events-none absolute -top-16 -right-16 h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'oklch(0.78 0.16 220 / 0.10)' }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_minmax(0,1fr)]">
            {/* Hero text */}
            <div className="lb-stagger space-y-6">
              <div
                className="border-primary/30 bg-primary/5 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide"
                style={{ ['--i' as string]: 0 }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Nền tảng giáo dục lập trình thế hệ mới
              </div>
              <h1
                className="text-foreground text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl md:text-6xl"
                style={{ ['--i' as string]: 1 }}
              >
                Chuyển đổi ước mơ bằng <span className="lb-gradient-text">mã nguồn thực tế</span>.
              </h1>
              <p
                className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg"
                style={{ ['--i' as string]: 2 }}
              >
                Nơi giáo viên kiến tạo những lớp học truyền cảm hứng và học sinh biến mọi ý tưởng
                thành sản phẩm. LumiBach đồng hành cùng hành trình khám phá tư duy thuật toán — từ
                những khối lệnh Scratch đầu tiên đến dòng Python chuyên nghiệp.
              </p>

              <div className="flex flex-wrap items-center gap-3" style={{ ['--i' as string]: 3 }}>
                {isLoggedIn ? (
                  <Magnetic>
                    <Link
                      href="/dashboard"
                      className={cn(
                        buttonVariants({ size: 'lg' }),
                        'gap-2 px-6 shadow-[0_4px_24px_rgb(253_8_93_/_35%)] transition-all hover:-translate-y-0.5 hover:brightness-110'
                      )}
                    >
                      Đến Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Magnetic>
                ) : (
                  <>
                    <Magnetic>
                      <Link
                        href="/register"
                        className={cn(
                          buttonVariants({ size: 'lg' }),
                          'gap-2 px-6 shadow-[0_4px_24px_rgb(253_8_93_/_35%)] transition-all hover:-translate-y-0.5 hover:brightness-110'
                        )}
                      >
                        Bắt đầu hành trình
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Magnetic>
                    <Magnetic>
                      <Link
                        href="/login"
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'lg' }),
                          'gap-2 px-6 transition-all hover:-translate-y-0.5'
                        )}
                      >
                        Đăng nhập
                      </Link>
                    </Magnetic>
                  </>
                )}
              </div>

              {/* Public stats strip */}
              <div className="flex items-center gap-6 pt-4" style={{ ['--i' as string]: 4 }}>
                <Stat label="Người học" value={userCount} />
                <div className="bg-border h-8 w-px" />
                <Stat label="Khoá học" value={courseCount} />
                <div className="bg-border h-8 w-px" />
                <Stat label="Bài giảng" value={lessonCount} />
              </div>
            </div>

            {/* Hero illustration: scale-in for entrance, inner div floats forever.
                Two wrappers so the float `transform` never overwrites scale-in. */}
            <div className="lb-scale-in" style={{ ['--lb-delay' as string]: '500ms' }}>
              <div className="lb-float-slow">
                <CodeEditorMock />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission / Philosophy ──────────────────────────────────── */}
      <section id="mission" className="border-border/60 border-y">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <p
            className="lb-reveal text-primary text-xs font-bold tracking-[0.2em] uppercase"
            style={{ ['--i' as string]: 0 }}
          >
            Triết lý
          </p>
          <h2
            className="lb-reveal mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl"
            style={{ ['--i' as string]: 1 }}
          >
            Mỗi học sinh đều xứng đáng có công cụ chuyên nghiệp
          </h2>
          <p
            className="lb-reveal text-muted-foreground mx-auto mt-3 max-w-2xl text-base leading-relaxed text-pretty"
            style={{ ['--i' as string]: 2 }}
          >
            Chúng tôi tin rằng việc học lập trình không nên bị giới hạn bởi bảng tính điểm thủ công,
            các nền tảng rời rạc, hay những công cụ không phù hợp lứa tuổi. LumiBach mang đến trải
            nghiệm liền mạch — học, thực hành, đánh giá và phản hồi — trong một không gian được
            thiết kế riêng cho giáo dục lập trình hiện đại.
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="border-border/60 border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p
              className="lb-reveal text-primary text-xs font-bold tracking-[0.2em] uppercase"
              style={{ ['--i' as string]: 0 }}
            >
              Tính năng
            </p>
            <h2
              className="lb-reveal mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
              style={{ ['--i' as string]: 1 }}
            >
              Bộ công cụ toàn diện cho giáo dục lập trình
            </h2>
            <p
              className="lb-reveal text-muted-foreground mx-auto mt-3 text-base text-pretty"
              style={{ ['--i' as string]: 2 }}
            >
              Từ soạn giáo trình đến chấm điểm — mọi công đoạn đều được tối ưu để giáo viên tập
              trung vào điều quan trọng nhất: truyền cảm hứng và đồng hành cùng học sinh.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                // Outer = reveal-on-scroll wrapper (handles entrance translate).
                // Inner = card with hover lift (separate transform context).
                <div key={f.title} className="lb-reveal" style={{ ['--i' as string]: i }}>
                  <TiltCard>
                    <div className="border-border bg-card hover:border-primary/40 group h-full rounded-xl border p-5 transition-shadow duration-200 hover:shadow-[0_8px_32px_oklch(0_0_0_/_0.18)]">
                      <div
                        className={cn(
                          'mb-3 inline-flex rounded-lg p-2.5 transition-transform duration-200 group-hover:scale-110',
                          f.color
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-foreground text-base font-semibold text-balance">
                        {f.title}
                      </h3>
                      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
                        {f.body}
                      </p>
                    </div>
                  </TiltCard>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Roadmap / How it works ────────────────────────────────── */}
      <section id="roadmap" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p
            className="lb-reveal text-primary text-xs font-bold tracking-[0.2em] uppercase"
            style={{ ['--i' as string]: 0 }}
          >
            Quy trình
          </p>
          <h2
            className="lb-reveal mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            style={{ ['--i' as string]: 1 }}
          >
            Bốn bước kiến tạo lớp học của bạn
          </h2>
          <p
            className="lb-reveal text-muted-foreground mx-auto mt-3 text-base text-pretty"
            style={{ ['--i' as string]: 2 }}
          >
            Một quy trình được tinh giản dựa trên kinh nghiệm thực tế của hàng trăm giáo viên Tin
            học — đơn giản, có thể triển khai ngay trong tuần đầu tiên.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((step, i) => (
            <div key={step.stage} className="lb-reveal" style={{ ['--i' as string]: i }}>
              <TiltCard>
                <div className="border-border bg-card hover:border-primary/40 relative h-full overflow-hidden rounded-xl border p-5 transition-shadow duration-200">
                  <div className="text-primary/15 absolute top-2 right-3 font-mono text-5xl font-black">
                    0{i + 1}
                  </div>
                  <div className="relative">
                    <p className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase">
                      {step.stage}
                    </p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-balance">
                      {step.title}
                    </h3>
                    <ul className="mt-3 space-y-1.5">
                      {step.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="text-primary/70 mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TiltCard>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="border-border/60 border-b">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lb-reveal" style={{ ['--i' as string]: 0 }}>
            <p className="text-primary inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Câu hỏi thường gặp
            </h2>
            <p className="text-muted-foreground mt-3 text-base text-pretty">
              Vài thông tin nhanh trước khi bạn bắt đầu lớp học đầu tiên.
            </p>
          </div>
          <div className="lb-reveal" style={{ ['--i' as string]: 1 }}>
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="border-border/60 relative overflow-hidden border-t">
        <MouseGlow />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgb(253 8 93 / 12%) 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <Terminal
            className="lb-reveal text-primary mx-auto mb-4 h-8 w-8"
            style={{
              filter: 'drop-shadow(0 0 12px rgb(253 8 93 / 50%))',
              ['--i' as string]: 0,
            }}
          />
          <h2
            className="lb-reveal text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            style={{ ['--i' as string]: 1 }}
          >
            Hãy cùng kiến tạo thế hệ lập trình viên tương lai
          </h2>
          <p
            className="lb-reveal text-muted-foreground mx-auto mt-3 max-w-xl text-base leading-relaxed text-pretty"
            style={{ ['--i' as string]: 2 }}
          >
            Khởi tạo tài khoản trong vài phút, thiết lập lớp học đầu tiên ngay hôm nay và bắt đầu
            hành trình truyền cảm hứng cho học sinh của bạn.
          </p>
          <div
            className="lb-reveal mt-7 flex flex-wrap justify-center gap-3"
            style={{ ['--i' as string]: 3 }}
          >
            {isLoggedIn ? (
              <Magnetic>
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-7')}
                >
                  Đến Dashboard
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Magnetic>
            ) : (
              <>
                <Magnetic>
                  <Link
                    href="/register"
                    className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-7')}
                  >
                    Khởi tạo tài khoản
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2 px-7')}
                  >
                    Đăng nhập
                  </Link>
                </Magnetic>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-border/60 border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Layers className="text-primary h-3.5 w-3.5" />
            <span>
              © {new Date().getFullYear()} LumiBach Learning. Kiến tạo bởi giáo viên, dành cho giáo
              viên.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-muted-foreground hover:text-foreground text-xs">
              Đăng nhập
            </Link>
            <span className="bg-border h-3 w-px" />
            <Link href="/register" className="text-muted-foreground hover:text-foreground text-xs">
              Đăng ký
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Stats strip item ──────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-foreground font-mono text-2xl font-bold tabular-nums">
        <CountUp to={value} duration={2000} />
      </p>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

// ── Stylised "code editor" hero illustration ──────────────────

function CodeEditorMock() {
  return (
    <div className="relative">
      {/* Outer glow */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-2xl blur-2xl"
        style={{ background: 'rgb(253 8 93 / 8%)' }}
        aria-hidden
      />
      <div
        className="relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl"
        style={{
          borderColor: 'rgb(255 255 255 / 0.12)',
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.02)), linear-gradient(135deg, #080b1a 0%, #0a0712 100%)',
        }}
      >
        {/* Edge glow */}
        <div
          className="pointer-events-none absolute -inset-px rounded-xl"
          style={{
            background:
              'linear-gradient(115deg, rgb(253 8 93 / 0.7), oklch(0.78 0.16 220 / 0.45), transparent 45%)',
            opacity: 0.22,
          }}
          aria-hidden
        />
        {/* Window chrome */}
        <div
          className="relative flex items-center gap-2 border-b px-3 py-2.5"
          style={{ borderColor: 'rgb(255 255 255 / 0.1)', background: 'rgb(4 6 17 / 0.45)' }}
        >
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <p className="font-mono text-[10px]" style={{ color: '#bfc8df' }}>
            bai-tap · python · tự chấm
          </p>
        </div>
        {/* Code body */}
        <div
          className="relative font-mono text-[12px] leading-relaxed"
          style={{ color: '#dce6ff' }}
        >
          <CodeLine n={1}>
            <KW>def</KW> <FN>sieve</FN>(n):
          </CodeLine>
          <CodeLine n={2}>
            {'    is_prime = ['}
            <FN>True</FN>
            {'] * (n + '}
            <NUM>1</NUM>
            {')'}
          </CodeLine>
          <CodeLine n={3}>
            {'    is_prime['}
            <NUM>0</NUM>
            {'] = is_prime['}
            <NUM>1</NUM>
            {'] = '}
            <FN>False</FN>
          </CodeLine>
          <CodeLine n={4}>
            {'    '}
            <KW>for</KW>
            {' i '}
            <KW>in</KW> <FN>range</FN>
            {'('}
            <NUM>2</NUM>
            {', '}
            <FN>int</FN>
            {'(n ** '}
            <NUM>0.5</NUM>
            {') + '}
            <NUM>1</NUM>
            {'):'}
          </CodeLine>
          <CodeLine n={5}>
            {'        '}
            <KW>if</KW>
            {' is_prime[i]:'}
          </CodeLine>
          <CodeLine n={6}>
            {'            '}
            <KW>for</KW>
            {' j '}
            <KW>in</KW> <FN>range</FN>
            {'(i * i, n + '}
            <NUM>1</NUM>
            {', i):'}
          </CodeLine>
          <CodeLine n={7} highlight>
            {'                is_prime[j] = '}
            <FN>False</FN>
          </CodeLine>
          <CodeLine n={8}>
            {'    '}
            <KW>return</KW>
            {' [i '}
            <KW>for</KW>
            {' i, p '}
            <KW>in</KW> <FN>enumerate</FN>
            {'(is_prime) '}
            <KW>if</KW>
            {' p]'}
          </CodeLine>
          <CodeLine n={9} />
          <CodeLine n={10}>
            <FN>print</FN>
            {'('}
            <FN>sieve</FN>
            {'('}
            <FN>int</FN>
            {'('}
            <FN>input</FN>
            {'())))'}
          </CodeLine>
        </div>
        {/* Result strip */}
        <div
          className="relative space-y-1 border-t px-3 py-2 text-[11px]"
          style={{ borderColor: 'rgb(255 255 255 / 0.08)', background: 'rgb(4 6 17 / 0.35)' }}
        >
          <p className="flex items-center gap-1.5" style={{ color: '#7dffbc' }}>
            <CheckCircle2 className="h-3 w-3" /> Test 1/5: n = 30 → 10 số nguyên tố
            <span className="ml-auto font-mono" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
              0.04s
            </span>
          </p>
          <p className="flex items-center gap-1.5" style={{ color: '#7dffbc' }}>
            <CheckCircle2 className="h-3 w-3" /> Test 2/5: n = 100 → 25 số nguyên tố
            <span className="ml-auto font-mono" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
              0.06s
            </span>
          </p>
          <p className="flex items-center gap-1.5 font-semibold" style={{ color: '#7dffbc' }}>
            <CheckCircle2 className="h-3 w-3" /> Hoàn thành 5/5 test
            <span className="ml-auto font-mono font-bold">100/100</span>
          </p>
        </div>
        {/* Typing console line */}
        <div
          className="relative border-t px-3 py-2 font-mono text-[11px]"
          style={{ borderColor: 'rgb(255 255 255 / 0.08)', background: 'rgb(2 4 12 / 0.55)' }}
        >
          <span style={{ color: '#ff5aa9' }}>$ </span>
          <Typewriter
            className="text-[#aeb8d4]"
            phrases={[
              'chấm tự động qua test case…',
              'tổng hợp điểm vào sổ điểm…',
              'ghi nhận tiến độ học sinh…',
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// Token màu cho code (theo bảng màu trang tham khảo).
function KW({ children }: { children: ReactNode }) {
  return <span style={{ color: '#ff5aa9' }}>{children}</span>;
}
function FN({ children }: { children: ReactNode }) {
  return <span style={{ color: '#75c8ff' }}>{children}</span>;
}
function NUM({ children }: { children: ReactNode }) {
  return <span style={{ color: '#e8b974' }}>{children}</span>;
}

function CodeLine({
  n,
  children,
  highlight = false,
}: {
  n: number;
  children?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 px-3 py-0.5',
        highlight && 'border-l-primary border-l-2 pl-[10px]'
      )}
      style={highlight ? { background: 'rgb(253 8 93 / 0.1)' } : undefined}
    >
      <span
        className="w-4 shrink-0 text-right font-mono text-[10px]"
        style={{ color: 'rgb(255 255 255 / 0.25)' }}
      >
        {n}
      </span>
      <code className="whitespace-pre">{children ?? ' '}</code>
    </div>
  );
}
