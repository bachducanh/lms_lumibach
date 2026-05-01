import type { Metadata } from 'next';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { Zap } from 'lucide-react';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function LoginPage() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/80 dark:bg-[oklch(0.175_0.035_258_/_0.85)] p-8 relative overflow-hidden backdrop-blur-xl shadow-xl dark:shadow-[0_0_0_1px_oklch(1_0_0_/_6%),0_24px_64px_oklch(0_0_0_/_0.5),0_0_40px_rgb(253_8_93_/_6%)]"
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] rounded-t-2xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgb(253 8 93 / 60%), oklch(0.80 0.13 210 / 0.4), transparent)' }}
      />

      {/* Card header */}
      <div className="text-center mb-8 space-y-2">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-3"
          style={{
            background: 'rgb(253 8 93 / 15%)',
            border: '1px solid rgb(253 8 93 / 30%)',
            boxShadow: '0 0 20px rgb(253 8 93 / 20%)',
          }}
        >
          <Zap
            className="h-6 w-6 text-primary"
            style={{ filter: 'drop-shadow(0 0 8px rgb(253 8 93 / 80%))' }}
          />
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Đăng nhập vào hệ thống học tập
        </p>
      </div>

      {/* Login form */}
      <LoginForm />
    </div>
  );
}
