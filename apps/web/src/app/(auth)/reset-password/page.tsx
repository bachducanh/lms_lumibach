import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) redirect('/forgot-password');

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="bg-primary text-primary-foreground mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md">
          <span className="text-sm font-bold">LB</span>
        </div>
        <CardTitle className="text-xl">Đặt lại mật khẩu</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
