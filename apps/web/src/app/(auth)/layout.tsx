import Image from 'next/image';
import { Zap } from 'lucide-react';
import { NebulaBackground } from '@/components/features/landing/NebulaBackground';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden p-4">
      {/* ── Nền nebula đồng bộ với landing page (lưới + hạt + gradient) ── */}
      <NebulaBackground />

      {/* ── Thương hiệu (đồng bộ cách trình bày ở sidebar) ── */}
      <div className="group relative flex items-center gap-3">
        {/* Logo icon với glow */}
        <div className="relative shrink-0">
          <div className="bg-primary absolute inset-0 rounded-lg opacity-25 blur-md" />
          <Image
            src="/LumiBach_firstLogo.png"
            alt="LumiBach"
            width={44}
            height={44}
            priority
            className="relative shrink-0 rounded-lg"
          />
        </div>

        <div className="flex flex-col leading-none">
          <span className="text-foreground text-2xl font-bold tracking-wide">LumiBach</span>
          <span className="text-primary mt-1 flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <Zap className="h-3 w-3" />
            Learn
          </span>
        </div>
      </div>

      {/* ── Auth card (children) ──────────────────────────── */}
      {children}
    </div>
  );
}
