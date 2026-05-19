import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { auth } from '@/auth';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage() {
  // Already signed in → bounce back to the landing page; registration is
  // for guests only.
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
        <CardDescription>Đăng ký để truy cập hệ thống</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
