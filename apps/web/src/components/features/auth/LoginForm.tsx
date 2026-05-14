'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type FormData = z.infer<typeof schema>;
type LoginError = 'credentials' | 'pending' | 'suspended' | null;

export function LoginForm() {
  const router = useRouter();
  const [loginError, setLoginError] = useState<LoginError>(null);
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoginError(null);
    setResendDone(false);

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (!result?.error) {
      router.push('/dashboard');
      router.refresh();
      return;
    }

    // Xác định lý do thất bại
    try {
      const { status } = await apiClient.post<{ status: string }>('/auth/check-status', {
        email: data.email,
      });
      if (status === 'pending') setLoginError('pending');
      else if (status === 'suspended') setLoginError('suspended');
      else setLoginError('credentials');
    } catch {
      setLoginError('credentials');
    }
  }

  async function handleResend() {
    setResending(true);
    await apiClient
      .post('/auth/resend-verification', { email: getValues('email') })
      .catch(() => null);
    setResending(false);
    setResendDone(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {loginError === 'credentials' && (
        <Alert className="border-destructive/50 text-destructive px-3 py-2 text-sm">
          Email hoặc mật khẩu không đúng.
        </Alert>
      )}

      {loginError === 'pending' && (
        <Alert className="space-y-1 border-amber-500/50 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <p>Tài khoản chưa được xác thực email.</p>
          {resendDone ? (
            <p className="text-xs">Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-xs font-medium underline underline-offset-2 disabled:opacity-50"
            >
              {resending ? 'Đang gửi...' : 'Gửi lại email xác thực'}
            </button>
          )}
        </Alert>
      )}

      {loginError === 'suspended' && (
        <Alert className="border-destructive/50 text-destructive px-3 py-2 text-sm">
          Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="ten@truong.edu.vn"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Đăng nhập
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/register" className="text-muted-foreground hover:text-primary hover:underline">
          Tạo tài khoản
        </Link>
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-primary hover:underline"
        >
          Quên mật khẩu?
        </Link>
      </div>
    </form>
  );
}
