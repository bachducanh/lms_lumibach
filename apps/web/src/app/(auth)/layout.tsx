import { CheckCircle2 } from 'lucide-react';
import { LumiLogo } from '@/components/features/landing/LumiLogo';
import { MarketingShell } from '@/components/features/landing/MarketingShell';
import { AuthTabs } from '@/components/features/auth/AuthTabs';

const POINTS = [
  'Viết và chạy code ngay trong trình duyệt',
  'Bài làm được chấm tự động qua test case',
  'Sổ điểm và báo cáo tiến độ luôn sẵn sàng',
];

/**
 * Khung chung cho các trang đăng nhập, đăng ký, quên/đặt lại mật khẩu, xác thực email.
 * Từ màn hình lớn: bên trái là panel thương hiệu (navy), bên phải là form.
 * Trên điện thoại chỉ còn logo phía trên form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell className="relative lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── Thanh màu thương hiệu trên đỉnh trang ──
          Vắt ngang cả hai cột nên phải nằm ngoài luồng lưới; z-20 để panel navy
          bên trái (có hai quầng blur) không phủ lên. */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-20 flex h-1.5">
        <span className="bg-lb-pink-strong w-[22%]" />
        <span className="bg-lb-navy-deep w-[18%]" />
        <span className="bg-lb-cyan flex-1" />
        <span className="bg-lb-navy w-[20%]" />
      </div>

      {/* ── Panel thương hiệu (ẩn trên mobile) ── */}
      <aside className="bg-lb-navy-deep lb-on-navy relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <span
          aria-hidden
          className="bg-lb-pink/80 absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        />
        <span
          aria-hidden
          className="bg-lb-cyan/30 absolute -right-24 -bottom-24 h-80 w-80 rounded-full blur-3xl"
        />
        <div className="relative">
          <LumiLogo tone="dark" size={44} priority />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-bold text-balance">
            Chuyển đổi ước mơ bằng <span className="text-lb-cyan">mã nguồn thực tế</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base text-white/85">
                <CheckCircle2 className="text-lb-cyan mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">
          © {new Date().getFullYear()} LumiBach Learning
        </p>
      </aside>

      {/* ── Vùng form ── */}
      <div className="bg-lb-tint flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
        <div className="lg:hidden">
          <LumiLogo size={44} priority />
        </div>
        {/* Hai tab đổi qua lại giữa đăng ký và đăng nhập; các trang khác trong
            nhóm (quên mật khẩu, xác thực email) không hiện tab. */}
        <AuthTabs />
        {children}
      </div>
    </MarketingShell>
  );
}
