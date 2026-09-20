import { LumiLogo } from '@/components/features/landing/LumiLogo';
import { MarketingShell } from '@/components/features/landing/MarketingShell';
import { AuthTabs } from '@/components/features/auth/AuthTabs';

/**
 * Khung chung cho các trang đăng nhập, đăng ký, quên/đặt lại mật khẩu, xác thực email.
 * Từ màn hình lớn: bên trái là panel thương hiệu (navy), bên phải là form.
 * Trên điện thoại chỉ còn logo phía trên form.
 *
 * Mép phải của panel cắt chéo chứ không thẳng đứng: hai hình chữ nhật đặt cạnh
 * nhau trông như hai trang bị dán lại, còn đường chéo buộc mắt đi từ khối chữ
 * bên trái sang ô nhập bên phải.
 *
 * Đường chéo cắt VÀO TRONG cột của panel, không tràn sang cột form. Bản đầu
 * kéo panel rộng thêm rồi mới cắt, và ở màn 1024px phần tràn đó che mất 80px
 * bên trái của cặp tab lẫn thẻ đăng nhập.
 */
const DIAGONAL = 'polygon(0 0, 100% 0, calc(100% - 7rem) 100%, 0 100%)';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
      <aside
        className="bg-lb-navy-deep lb-on-navy relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:py-12 lg:pr-32 lg:pl-12"
        style={{ clipPath: DIAGONAL, WebkitClipPath: DIAGONAL }}
      >
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

        <div className="relative flex max-w-xl items-stretch gap-7">
          {/* Vạch hồng nghiêng, lặp lại góc nghiêng của mép panel. */}
          <span aria-hidden className="bg-lb-pink w-2 shrink-0 -skew-x-12 rounded-full" />
          <h2 className="text-5xl leading-[1.05] font-bold text-balance xl:text-6xl">
            Chuyển đổi ước mơ bằng <span className="text-lb-cyan">mã nguồn thực tế</span>.
          </h2>
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
