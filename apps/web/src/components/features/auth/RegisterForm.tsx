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
import { Loader2, CheckCircle } from 'lucide-react';
import { registerAction } from '@/actions/auth';

const schema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
    password: z
      .string()
      .min(8, 'Tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Cần có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Cần có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const res = await registerAction({
      email: data.email,
      fullName: data.fullName,
      password: data.password,
    });
    if (res.success) {
      setResult({ success: true, message: res.message });
    } else {
      setResult({ success: false, message: res.error });
    }
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <p className="text-muted-foreground text-sm">{result.message}</p>
        <Link href="/login" className="text-primary text-sm font-medium hover:underline">
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {result && !result.success && (
        <Alert className="border-destructive/50 text-destructive px-3 py-2 text-sm">
          {result.message}
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Họ và tên</Label>
        <Input id="fullName" placeholder="Nguyễn Văn A" {...register('fullName')} />
        {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
      </div>

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
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-destructive text-xs">{errors.password.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">Tối thiểu 8 ký tự, có chữ hoa và chữ số</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Tạo tài khoản
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
