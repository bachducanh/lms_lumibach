import type { ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Cat,
  CheckCircle2,
  Code2,
  FileText,
  MonitorPlay,
  Sparkles,
  Table2,
  Terminal,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/features/landing/CountUp';
import { FaqAccordion } from '@/components/features/landing/FaqAccordion';
import { CodeWindow } from '@/components/features/landing/CodeWindow';
import { LumiLogo } from '@/components/features/landing/LumiLogo';
import { MarketingShell } from '@/components/features/landing/MarketingShell';
import { MobileNav } from '@/components/features/landing/MobileNav';

export const metadata = {
  title: 'LumiBach — Chuyển đổi ước mơ bằng mã nguồn thực tế',
  description:
    'Nền tảng giáo dục lập trình toàn diện cho thế hệ tiếp theo. Khơi nguồn cảm hứng, kiến tạo tư duy thuật toán, hiện thực hoá ý tưởng qua từng dòng code.',
};

export const dynamic = 'force-dynamic';

// ── Nội dung ────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Lộ trình học', href: '#tracks' },
  { label: 'Tính năng', href: '#features' },
  { label: 'Quy trình', href: '#roadmap' },
  { label: 'Câu hỏi thường gặp', href: '#faq' },
];

const TRACKS: {
  glyph: string;
  title: string;
  body: string;
  tag: string;
  tone: string;
}[] = [
  {
    glyph: 'Sc',
    // U+2060 (word joiner) quanh dấu gạch: tiêu đề không bị ngắt dòng ngay tại đó.
    title: 'Lập trình kéo\u2060–\u2060thả Scratch',
    body: 'Trình soạn thảo Scratch nhúng trực tiếp, giúp học sinh nhỏ tuổi làm quen tư duy lập trình mà không cần gõ code.',
    tag: 'Kéo–thả · Tiểu học',
    tone: 'bg-lb-pink-strong text-white',
  },
  {
    glyph: 'Py',
    title: 'Nhập môn Python',
    body: 'Viết và chạy Python ngay trong trình duyệt; bài làm được chấm tự động qua test case chỉ trong vài giây.',
    tag: 'Chấm tự động',
    tone: 'bg-lb-navy text-white',
  },
  {
    glyph: 'C++',
    title: 'C++ và tư duy thuật toán',
    body: 'Rèn giải thuật với bài tập chấm tức thời, kèm bộ test case do chính giáo viên thiết kế.',
    tag: 'Chấm tự động',
    tone: 'bg-lb-navy-mid text-lb-cyan',
  },
  {
    glyph: '</>',
    title: 'Web: HTML, CSS, JavaScript',
    body: 'Xây dựng trang web đầu tiên và xem kết quả ngay bên cạnh khung soạn thảo, không cần cài đặt gì.',
    tag: 'Thực hành trên trình duyệt',
    tone: 'bg-lb-cyan text-lb-navy-deep',
  },
];

const HIGHLIGHTS: { icon: typeof BookOpen; text: string }[] = [
  { icon: MonitorPlay, text: 'Chạy hoàn toàn trên trình duyệt, không cần cài đặt' },
  { icon: Code2, text: 'Chấm code tự động qua test case' },
  { icon: Table2, text: 'Nhập danh sách lớp từ Excel trong vài giây' },
];

const FEATURES: {
  icon: typeof BookOpen;
  title: string;
  body: string;
  tone: string;
}[] = [
  {
    icon: BookOpen,
    title: 'Giáo trình có cấu trúc',
    body: 'Tổ chức nội dung theo chương — bài giảng, bài tập, quiz, project — dẫn dắt học sinh đi từ nền tảng đến nâng cao theo lộ trình rõ ràng.',
    tone: 'bg-lb-pink-soft text-lb-pink-strong',
  },
  {
    icon: Code2,
    title: 'Chấm code tức thời',
    body: 'Học sinh viết Python, C++ hoặc Web ngay trong trình duyệt; hệ thống tự kiểm thử qua test case, trả kết quả trong vài giây.',
    tone: 'bg-lb-cyan-soft text-lb-navy',
  },
  {
    icon: Brain,
    title: 'Ngân hàng câu hỏi đa dạng',
    body: 'Mười hai dạng câu hỏi — từ trắc nghiệm, tự luận đến Parsons, Debug, điền chỗ trống — đo lường tư duy ở mọi cấp độ Bloom.',
    tone: 'bg-lb-pink-soft text-lb-pink-strong',
  },
  {
    icon: Cat,
    title: 'Lập trình kéo–thả Scratch',
    body: 'Trình soạn thảo Scratch nhúng trực tiếp giúp học sinh nhỏ tuổi tiếp cận tư duy lập trình mà không cần rời nền tảng.',
    tone: 'bg-lb-cyan-soft text-lb-navy',
  },
  {
    icon: FileText,
    title: 'Đánh giá & rubric',
    body: 'Chấm điểm theo rubric tuỳ biến, tổng hợp tự động vào sổ điểm, xuất báo cáo tiến độ chuyên nghiệp cho phụ huynh và nhà trường.',
    tone: 'bg-lb-pink-soft text-lb-pink-strong',
  },
  {
    icon: Sparkles,
    title: 'Phân tích & theo dõi thời gian thực',
    body: 'Dashboard trực quan cho phép giáo viên nắm bắt mức độ tham gia, phát hiện học sinh gặp khó khăn và can thiệp đúng lúc.',
    tone: 'bg-lb-cyan-soft text-lb-navy',
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

// Khung nội dung dùng chung cho mọi section.
const CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6';

// ── Trang ───────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Public stats — only counts, never PII
  const [userCount, courseCount, lessonCount] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.course.count({ where: { deletedAt: null, status: 'PUBLISHED' } }).catch(() => 0),
    prisma.moduleItem.count({ where: { type: 'LESSON' } }).catch(() => 0),
  ]);
  // Chưa có dữ liệu (hoặc DB tạm lỗi) thì ẩn cả dải số liệu thay vì hiện "0 · 0 · 0".
  const hasStats = userCount + courseCount + lessonCount > 0;

  const primaryHref = isLoggedIn ? '/dashboard' : '/register';

  return (
    <MarketingShell>
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className={cn(CONTAINER, 'relative flex h-16 items-center justify-between gap-4')}>
          <LumiLogo />

          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-foreground hover:bg-muted hover:text-primary rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-10 gap-1.5 rounded-full px-4 font-semibold'
                  )}
                >
                  Vào Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'lg' }),
                      'h-10 rounded-full px-4 font-semibold'
                    )}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: 'lg' }),
                      'h-10 rounded-full px-4 font-semibold'
                    )}
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
            <MobileNav links={NAV_LINKS} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="bg-lb-tint relative overflow-hidden">
          {/* lưới chấm mờ, tan dần xuống dưới */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgb(0 62 120 / 0.14) 1px, transparent 1.5px)',
              backgroundSize: '22px 22px',
              maskImage: 'linear-gradient(to bottom, black 30%, transparent 95%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 95%)',
            }}
          />
          <div className={cn(CONTAINER, 'relative py-14 sm:py-20 lg:py-24')}>
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,1fr)] lg:gap-14">
              <div>
                <p className="text-lb-navy border-lb-navy/20 inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-sm font-semibold">
                  <span className="bg-lb-pink h-2 w-2 rounded-full" aria-hidden />
                  Nền tảng giáo dục lập trình thế hệ mới
                </p>

                <h1 className="text-foreground mt-6 text-4xl leading-[1.1] font-bold text-balance sm:text-5xl lg:text-[3.75rem]">
                  Chuyển đổi ước mơ bằng <span className="text-primary">mã nguồn thực tế</span>.
                </h1>

                <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty">
                  Nơi giáo viên kiến tạo những lớp học truyền cảm hứng và học sinh biến mọi ý tưởng
                  thành sản phẩm. LumiBach đồng hành cùng hành trình khám phá tư duy thuật toán — từ
                  những khối lệnh Scratch đầu tiên đến dòng Python chuyên nghiệp.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={primaryHref}
                    className={cn(
                      buttonVariants({ size: 'lg' }),
                      'h-12 gap-2 rounded-full px-7 text-base font-semibold'
                    )}
                  >
                    {isLoggedIn ? 'Đến Dashboard' : 'Bắt đầu hành trình'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {!isLoggedIn && (
                    <Link
                      href="/login"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'lg' }),
                        'border-lb-navy text-lb-navy hover:bg-lb-navy h-12 rounded-full bg-white px-7 text-base font-semibold hover:text-white'
                      )}
                    >
                      Đăng nhập
                    </Link>
                  )}
                </div>

                {/* Lối tắt theo chủ đề — thay cho ô tìm kiếm khoá học của edX */}
                <div className="mt-8 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground mb-1 w-full text-sm font-medium">
                    Bạn muốn học gì?
                  </span>
                  {['Scratch', 'Python', 'C++', 'Web', 'Thuật toán'].map((topic) => (
                    <a
                      key={topic}
                      href="#tracks"
                      className="border-border text-foreground hover:border-lb-navy hover:bg-lb-navy rounded-full border bg-white px-3.5 py-1.5 text-sm font-medium transition-colors hover:text-white"
                    >
                      {topic}
                    </a>
                  ))}
                </div>
              </div>

              {/* Minh hoạ: khung code + hai mảng màu thương hiệu phía sau */}
              <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                <div
                  aria-hidden
                  className="bg-lb-pink absolute -top-4 -right-4 h-2/3 w-2/3 rounded-xl sm:-top-5 sm:-right-5"
                />
                <div
                  aria-hidden
                  className="bg-lb-cyan absolute -bottom-4 -left-4 h-1/3 w-1/2 rounded-xl sm:-bottom-5 sm:-left-5"
                />
                <CodeWindow className="relative" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Số liệu công khai (chỉ khi có dữ liệu thật) ─────────── */}
        {hasStats && (
          <section className="bg-lb-navy-deep text-white" aria-label="Số liệu nền tảng">
            <dl className={cn(CONTAINER, 'grid grid-cols-3 gap-4 py-8 text-center sm:py-10')}>
              <Stat label="Người học" value={userCount} />
              <Stat label="Khoá học" value={courseCount} />
              <Stat label="Bài giảng" value={lessonCount} />
            </dl>
          </section>
        )}

        {/* ── Điểm nổi bật ────────────────────────────────────────── */}
        <section aria-label="Điểm nổi bật" className="border-border border-b">
          <ul className={cn(CONTAINER, 'grid gap-4 py-8 md:grid-cols-3 md:gap-8')}>
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5">
                <span className="bg-lb-cyan-soft text-lb-navy flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-foreground text-base font-medium text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Lộ trình học ────────────────────────────────────────── */}
        <section id="tracks" className={cn(CONTAINER, 'py-16 sm:py-24')}>
          <SectionHead
            eyebrow="Lộ trình học"
            title="Khám phá các lộ trình học"
            lede="Từ những khối lệnh kéo–thả đầu tiên đến dòng Python chuyên nghiệp — chọn điểm bắt đầu phù hợp với lớp của bạn."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((t) => (
              <li key={t.title} className="flex">
                <Link
                  href={primaryHref}
                  className="group focus-visible:outline-lb-navy flex w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <article className="bg-card flex w-full flex-col overflow-hidden rounded-xl border border-[#cfd6e1] shadow-sm transition-shadow duration-300 group-hover:shadow-[0_4px_18px_rgb(11_31_54_/_16%)]">
                    <div
                      className={cn(
                        'relative flex h-24 items-center justify-end overflow-hidden pr-6 text-4xl font-extrabold tracking-tight',
                        t.tone
                      )}
                      aria-hidden
                    >
                      <span
                        className="absolute inset-0 opacity-25"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle, currentColor 1px, transparent 1.5px)',
                          backgroundSize: '16px 16px',
                        }}
                      />
                      <span className="relative">{t.glyph}</span>
                    </div>
                    <div className="flex flex-1 flex-col px-4 pt-4 pb-5">
                      <p className="text-muted-foreground mb-1 text-sm font-semibold">{t.tag}</p>
                      <h3 className="text-foreground text-xl leading-[1.4] font-bold text-balance">
                        {t.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed text-pretty">
                        {t.body}
                      </p>
                      <span className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                        {isLoggedIn ? 'Vào học' : 'Bắt đầu học'}
                        <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
                      </span>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Triết lý ────────────────────────────────────────────── */}
        <section className="bg-lb-tint">
          <div className={cn(CONTAINER, 'py-16 sm:py-20')}>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[auto_1fr] md:gap-10">
              <span className="bg-lb-pink hidden w-1.5 rounded-full md:block" aria-hidden />
              <div>
                <p className="text-primary text-base font-bold">Triết lý</p>
                <h2 className="text-foreground mt-3 text-2xl leading-snug font-bold text-balance sm:text-3xl">
                  Chuyển đổi ước mơ bằng mã nguồn thực tế
                </h2>
                <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
                  Chúng tôi tin rằng việc học lập trình không nên bị giới hạn bởi bảng tính điểm thủ
                  công, các nền tảng rời rạc, hay những công cụ không phù hợp lứa tuổi. LumiBach
                  mang đến trải nghiệm liền mạch — học, thực hành, đánh giá và phản hồi — trong một
                  không gian được thiết kế riêng cho giáo dục lập trình hiện đại.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tính năng ───────────────────────────────────────────── */}
        <section id="features" className={cn(CONTAINER, 'py-16 sm:py-24')}>
          <SectionHead
            eyebrow="Tính năng"
            title="Bộ công cụ toàn diện cho giáo dục lập trình"
            lede="Từ soạn giáo trình đến chấm điểm — mọi công đoạn đều được tối ưu để giáo viên tập trung vào điều quan trọng nhất: truyền cảm hứng và đồng hành cùng học sinh."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li
                  key={f.title}
                  className="border-border bg-card rounded-xl border p-6 shadow-sm transition-shadow duration-300 hover:shadow-[0_4px_18px_rgb(11_31_54_/_14%)]"
                >
                  <span
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-lg',
                      f.tone
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="text-foreground mt-5 text-lg font-bold text-balance">{f.title}</h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed text-pretty">
                    {f.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Quy trình ───────────────────────────────────────────── */}
        <section id="roadmap" className="bg-lb-tint">
          <div className={cn(CONTAINER, 'py-16 sm:py-24')}>
            <SectionHead
              eyebrow="Quy trình"
              title="Bốn bước kiến tạo lớp học của bạn"
              lede="Một quy trình được tinh giản dựa trên kinh nghiệm thực tế của hàng trăm giáo viên Tin học — đơn giản, có thể triển khai ngay trong tuần đầu tiên."
            />
            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {ROADMAP.map((step, i) => (
                <li key={step.stage} className="relative">
                  {/* đường nối giữa các bước (chỉ desktop) */}
                  {i < ROADMAP.length - 1 && (
                    <span
                      aria-hidden
                      className="bg-lb-navy/20 absolute top-6 left-14 hidden h-px w-[calc(100%-2rem)] lg:block"
                    />
                  )}
                  <span className="bg-lb-navy font-display relative flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="text-primary mt-5 text-sm font-bold">{step.stage}</p>
                  <h3 className="text-foreground mt-1 text-xl font-bold text-balance">
                    {step.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {step.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-base">
                        <CheckCircle2
                          className="text-lb-navy mt-0.5 h-[18px] w-[18px] shrink-0"
                          aria-hidden
                        />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section id="faq" className={cn(CONTAINER, 'py-16 sm:py-24')}>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-primary text-base font-bold">FAQ</p>
              <h2 className="text-foreground mt-3 text-3xl font-bold text-balance sm:text-4xl">
                Câu hỏi thường gặp
              </h2>
              <p className="text-muted-foreground mt-4 text-lg text-pretty">
                Vài thông tin nhanh trước khi bạn bắt đầu lớp học đầu tiên.
              </p>
            </div>
            <FaqAccordion items={FAQS} />
          </div>
        </section>

        {/* ── CTA cuối trang ──────────────────────────────────────── */}
        <section className={cn(CONTAINER, 'pb-16 sm:pb-24')}>
          <div className="bg-lb-navy-deep lb-on-navy relative overflow-hidden rounded-xl px-6 py-14 text-center sm:px-12 sm:py-20">
            <span
              aria-hidden
              className="bg-lb-pink/90 absolute -top-16 -left-16 h-48 w-48 rounded-full blur-3xl"
            />
            <span
              aria-hidden
              className="bg-lb-cyan/40 absolute -right-16 -bottom-20 h-56 w-56 rounded-full blur-3xl"
            />
            <div className="relative mx-auto max-w-2xl">
              <Terminal className="text-lb-cyan mx-auto h-9 w-9" aria-hidden />
              <h2 className="mt-5 text-3xl font-bold text-balance text-white sm:text-4xl">
                Kết nối công nghệ, kiến tạo tri thức
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-pretty text-white/80">
                Khởi tạo tài khoản trong vài phút, thiết lập lớp học đầu tiên ngay hôm nay và bắt
                đầu hành trình truyền cảm hứng cho học sinh của bạn.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={primaryHref}
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-12 gap-2 rounded-full px-7 text-base font-semibold'
                  )}
                >
                  {isLoggedIn ? 'Đến Dashboard' : 'Khởi tạo tài khoản'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {!isLoggedIn && (
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'lg' }),
                      'hover:text-lb-navy-deep h-12 rounded-full border-white/60 bg-transparent px-7 text-base font-semibold text-white hover:bg-white'
                    )}
                  >
                    Đăng nhập
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="bg-lb-navy-deep lb-on-navy text-white">
        <div className={cn(CONTAINER, 'grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]')}>
          <div>
            <LumiLogo tone="dark" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
              Nền tảng giáo dục lập trình toàn diện — kiến tạo bởi giáo viên, dành cho giáo viên.
            </p>
          </div>
          <FooterColumn
            title="Khám phá"
            links={NAV_LINKS.map((l) => ({ label: l.label, href: l.href }))}
          />
          <FooterColumn
            title="Tài khoản"
            links={
              isLoggedIn
                ? [{ label: 'Vào Dashboard', href: '/dashboard' }]
                : [
                    { label: 'Đăng nhập', href: '/login' },
                    { label: 'Đăng ký', href: '/register' },
                  ]
            }
          />
        </div>
        <div className="border-t border-white/10">
          <p className={cn(CONTAINER, 'py-5 text-sm text-white/65')}>
            © {new Date().getFullYear()} LumiBach Learning. Kiến tạo bởi giáo viên, dành cho giáo
            viên.
          </p>
        </div>
      </footer>
    </MarketingShell>
  );
}

// ── Thành phần nhỏ ────────────────────────────────────────────────

function SectionHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-primary text-base font-bold">{eyebrow}</p>
      <h2 className="text-foreground mt-3 text-3xl font-bold text-balance sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">{lede}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  // dt (nhãn) đứng trước dd (giá trị) trong DOM cho đúng ngữ nghĩa; hiển thị đảo lại.
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-sm font-medium text-white/80 sm:text-base">{label}</dt>
      <dd className="font-display text-3xl font-bold tabular-nums sm:text-5xl">
        <CountUp to={value} duration={1600} />
      </dd>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-white/75 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
