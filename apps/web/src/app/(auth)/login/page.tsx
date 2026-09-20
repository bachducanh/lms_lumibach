import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { AlertCircle } from 'lucide-react';
import { auth } from '@/auth';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Đăng nhập' };

const REASON_LABEL: Record<string, string> = {
  'session-stale':
    'Phiên đăng nhập cũ không còn hợp lệ (tài khoản bị xoá hoặc khoá học đã được cập nhật). Vui lòng đăng nhập lại.',
};

/**
 * Chỉ chấp nhận đường dẫn nội bộ. Chặn `//host` và `\\host` — trình duyệt coi
 * đó là URL tuyệt đối, nếu nhận bừa sẽ thành lỗ hổng open redirect.
 */
function safeNext(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const { reason, next } = await searchParams;
  const nextPath = safeNext(next);
  // Already signed in → send users back to the landing page (they don't
  // need the login form). The dashboard is one click away from there.
  // Khi có `next` (ví dụ Safe Exam Browser mở thẳng vào bài thi) thì đi tiếp
  // tới đúng hoạt động thay vì đổ về landing page.
  // Skip the redirect when there's a reason on the query — that means we
  // were just bounced here on purpose (eg. stale session) and showing
  // them the login form makes sense.
  if (!reason) {
    const session = await auth();
    if (session?.user) redirect(nextPath ?? '/');
  }
  const notice = reason ? REASON_LABEL[reason] : null;

  return (
    // Tiêu đề trang do cặp tab phía trên đảm nhiệm.
    <Card className="w-full max-w-md gap-4 py-8">
      <CardContent className="space-y-5 px-8">
        <p className="text-muted-foreground text-base">Đăng nhập vào hệ thống học tập</p>

        {notice && (
          <div
            role="alert"
            className="border-primary/40 bg-lb-pink-soft text-primary mb-6 flex gap-2 rounded-lg border px-3 py-2.5 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Login form */}
        <LoginForm next={nextPath} />
      </CardContent>
    </Card>
  );
}
