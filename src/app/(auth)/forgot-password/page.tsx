import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Quên mật khẩu' };

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-sm font-bold">LB</span>
        </div>
        <CardTitle className="text-xl">Quên mật khẩu?</CardTitle>
        <CardDescription>
          Nhập email đã đăng ký — chúng tôi sẽ gửi link đặt lại mật khẩu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
