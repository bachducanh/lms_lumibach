import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden p-4">
      {/* ── Background tech grid ──────────────────────────── */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="auth-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* ── Glow orbs ─────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute top-1/4 right-1/4 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'rgb(253 8 93 / 8%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full blur-3xl"
        style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
      />

      {/* ── Animated border lines (decorative) ───────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 right-0 left-0 h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgb(253 8 93 / 40%) 50%, transparent 100%)',
          }}
        />
        <div
          className="absolute right-0 bottom-0 left-0 h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, oklch(0.80 0.13 210 / 0.3) 50%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-2">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full blur-xl"
            style={{ background: 'rgb(253 8 93 / 15%)' }}
          />
          <Image
            src="/LumiBach_secondlogo.png"
            alt="LumiBach"
            width={200}
            height={64}
            priority
            className="relative drop-shadow-[0_0_24px_rgb(253_8_93_/_30%)]"
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>
        <p className="text-primary/60 mt-1 text-[10px] font-semibold tracking-[0.3em] uppercase">
          Learning Platform
        </p>
      </div>

      {/* ── Auth card (children) ──────────────────────────── */}
      {children}
    </div>
  );
}
