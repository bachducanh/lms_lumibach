import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { auth } from '@/auth';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage() {
  // Already signed in → bounce back to the landing page; registration is
  // for guests only.
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    // Tiêu đề trang do cặp tab phía trên đảm nhiệm, nên thẻ này không lặp lại
    // chữ "Tạo tài khoản" một lần nữa.
    <Card className="w-full max-w-md gap-4 py-8">
      <CardContent className="space-y-5 px-8">
        <p className="text-muted-foreground text-base">Đăng ký để truy cập hệ thống</p>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
