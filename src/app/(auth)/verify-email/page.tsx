import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, XCircle, MailX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { verifyEmailAction } from '@/actions/auth';

export const metadata: Metadata = { title: 'Xác thực email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
          <CardTitle className="text-lg">Liên kết không hợp lệ</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Không tìm thấy token xác thực.</p>
          <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Quay lại đăng nhập
          </Link>
        </CardContent>
      </Card>
    );
  }

  const result = await verifyEmailAction(token);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        {result.success ? (
          <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        ) : (
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
        )}
        <CardTitle className="text-lg">
          {result.success ? 'Xác thực thành công!' : 'Xác thực thất bại'}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          {result.success ? result.message : result.error}
        </p>
        {result.success ? (
          <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
            Đăng nhập ngay
          </Link>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Liên kết đã hết hạn? Đăng nhập và yêu cầu gửi lại email xác thực.
            </p>
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
