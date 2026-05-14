'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2, MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <MailCheck className="text-primary h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài
          phút.
        </p>
        <Link href="/login" className="text-primary text-sm font-medium hover:underline">
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert className="border-destructive/50 text-destructive px-3 py-2 text-sm">{error}</Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email đã đăng ký</Label>
        <Input
          id="email"
          type="email"
          placeholder="ten@truong.edu.vn"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Gửi hướng dẫn đặt lại
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-primary hover:underline">
          ← Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}
