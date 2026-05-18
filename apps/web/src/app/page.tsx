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
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { CountUp } from '@/components/features/landing/CountUp';
import { MouseGlow } from '@/components/features/landing/MouseGlow';
import { ParallaxBlob } from '@/components/features/landing/ParallaxBlob';

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
    <div className="bg-background min-h-screen">
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
            <a href="#mission" className="hover:text-foreground transition-colors">
              Triết lý
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
        {/* Tech grid background */}
        <svg
          className="text-foreground pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>

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
                Chuyển đổi ước mơ bằng{' '}
                <span
                  className="text-primary"
                  style={{ textShadow: '0 0 24px rgb(253 8 93 / 35%)' }}
                >
                  mã nguồn thực tế
                </span>
                .
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
                ) : (
                  <>
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
                    <Link
                      href="/login"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'lg' }),
                        'gap-2 px-6 transition-all hover:-translate-y-0.5'
                      )}
                    >
                      Đăng nhập
                    </Link>
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
      <section id="mission" className="border-border/60 bg-card/30 border-y">
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
                  <div className="border-border bg-card hover:border-primary/40 group h-full rounded-xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_32px_oklch(0_0_0_/_0.18)]">
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
              <div className="border-border bg-card hover:border-primary/40 relative h-full overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-1">
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
            </div>
          ))}
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
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-7')}>
                Đến Dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/register" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-7')}>
                  Khởi tạo tài khoản
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2 px-7')}
                >
                  Đăng nhập
                </Link>
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
      <div className="border-border bg-card relative overflow-hidden rounded-xl border shadow-2xl">
        {/* Window chrome */}
        <div className="border-border/60 bg-muted/40 flex items-center gap-2 border-b px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <p className="text-muted-foreground font-mono text-[10px]">bai-tap · python · tự chấm</p>
        </div>
        {/* Code body */}
        <div className="font-mono text-[12px] leading-relaxed">
          <CodeLine n={1} text="def sieve(n):" />
          <CodeLine n={2} text="    is_prime = [True] * (n + 1)" />
          <CodeLine n={3} text="    is_prime[0] = is_prime[1] = False" />
          <CodeLine n={4} text="    for i in range(2, int(n ** 0.5) + 1):" />
          <CodeLine n={5} text="        if is_prime[i]:" />
          <CodeLine n={6} text="            for j in range(i * i, n + 1, i):" />
          <CodeLine n={7} text="                is_prime[j] = False" highlight />
          <CodeLine n={8} text="    return [i for i, p in enumerate(is_prime) if p]" />
          <CodeLine n={9} text="" />
          <CodeLine n={10} text="print(sieve(int(input())))" />
        </div>
        {/* Result strip */}
        <div className="border-border/60 bg-muted/30 space-y-1 border-t px-3 py-2 text-[11px]">
          <p className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Test 1/5: n = 30 → 10 số nguyên tố
            <span className="text-muted-foreground ml-auto font-mono">0.04s</span>
          </p>
          <p className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Test 2/5: n = 100 → 25 số nguyên tố
            <span className="text-muted-foreground ml-auto font-mono">0.06s</span>
          </p>
          <p className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Hoàn thành 5/5 test
            <span className="ml-auto font-mono font-bold text-emerald-500">100/100</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CodeLine({
  n,
  text,
  highlight = false,
}: {
  n: number;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 px-3 py-0.5',
        highlight && 'bg-primary/5 border-l-primary border-l-2 pl-[10px]'
      )}
    >
      <span className="text-muted-foreground/40 w-4 shrink-0 text-right font-mono text-[10px]">
        {n}
      </span>
      <code className="text-foreground/85 whitespace-pre">{text || ' '}</code>
    </div>
  );
}
