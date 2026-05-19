import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { AlertCircle, Zap } from 'lucide-react';
import { auth } from '@/auth';

export const metadata: Metadata = { title: 'Đăng nhập' };

const REASON_LABEL: Record<string, string> = {
  'session-stale':
    'Phiên đăng nhập cũ không còn hợp lệ (tài khoản bị xoá hoặc khoá học đã được cập nhật). Vui lòng đăng nhập lại.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  // Already signed in → send users back to the landing page (they don't
  // need the login form). The dashboard is one click away from there.
  // Skip the redirect when there's a reason on the query — that means we
  // were just bounced here on purpose (eg. stale session) and showing
  // them the login form makes sense.
  if (!reason) {
    const session = await auth();
    if (session?.user) redirect('/');
  }
  const notice = reason ? REASON_LABEL[reason] : null;

  return (
    <div className="border-border/60 bg-card/80 relative w-full max-w-sm overflow-hidden rounded-2xl border p-8 shadow-xl backdrop-blur-xl dark:bg-[oklch(0.175_0.035_258_/_0.85)] dark:shadow-[0_0_0_1px_oklch(1_0_0_/_6%),0_24px_64px_oklch(0_0_0_/_0.5),0_0_40px_rgb(253_8_93_/_6%)]">
      {/* Top accent glow line */}
      <div
        className="absolute top-0 right-0 left-0 h-[1px] rounded-t-2xl"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgb(253 8 93 / 60%), oklch(0.80 0.13 210 / 0.4), transparent)',
        }}
      />

      {/* Card header */}
      <div className="mb-8 space-y-2 text-center">
        <div
          className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background: 'rgb(253 8 93 / 15%)',
            border: '1px solid rgb(253 8 93 / 30%)',
            boxShadow: '0 0 20px rgb(253 8 93 / 20%)',
          }}
        >
          <Zap
            className="text-primary h-6 w-6"
            style={{ filter: 'drop-shadow(0 0 8px rgb(253 8 93 / 80%))' }}
          />
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="text-muted-foreground text-sm">Đăng nhập vào hệ thống học tập</p>
      </div>

      {notice && (
        <div className="border-primary/40 bg-primary/5 text-primary mb-6 flex gap-2 rounded-lg border px-3 py-2.5 text-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Login form */}
      <LoginForm />
    </div>
  );
}
