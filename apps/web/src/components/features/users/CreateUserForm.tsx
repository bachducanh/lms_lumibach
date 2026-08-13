'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/select';

/** Dùng chung cho form tạo và form sửa người dùng. */
export const VAI_TRO_OPTIONS = [
  { value: 'STUDENT', label: 'Học sinh' },
  { value: 'TA', label: 'Trợ giảng (TA)' },
  { value: 'TEACHER', label: 'Giáo viên' },
  { value: 'ADMIN', label: 'Quản trị viên' },
] as const;

export const TRANG_THAI_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Không hoạt động' },
  { value: 'SUSPENDED', label: 'Tạm khoá' },
  { value: 'PENDING', label: 'Chờ xác thực' },
] as const;

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự'),
  role: z.enum(['ADMIN', 'TEACHER', 'TA', 'STUDENT']),
  password: z.string().min(8, 'Tối thiểu 8 ký tự').optional().or(z.literal('')),
  phone: z.string().optional(),
  username: z.string().min(3, 'Tối thiểu 3 ký tự').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'STUDENT',
      password: '',
      phone: '',
      username: '',
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ password: string; userId: string }>('/users', values);
        toast.success('Tạo tài khoản thành công.');
        setGeneratedPassword(data.password);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi tạo tài khoản');
      }
    });
  }

  if (generatedPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tạo tài khoản thành công!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">Mật khẩu tạm thời:</p>
          <code className="bg-muted block rounded-lg px-4 py-3 font-mono text-lg font-bold tracking-wider">
            {generatedPassword}
          </code>
          <p className="text-muted-foreground text-xs">
            Ghi lại và gửi cho người dùng. Họ có thể đổi mật khẩu sau khi đăng nhập.
          </p>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => router.push('/admin/users')}>Danh sách người dùng</Button>
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedPassword(null);
                form.reset();
              }}
            >
              Tạo thêm
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="nguyen@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ và tên *</FormLabel>
              <FormControl>
                <Input placeholder="Nguyễn Văn A" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vai trò *</FormLabel>
              <FormControl>
                <SimpleSelect
                  className="w-full"
                  aria-label="Vai trò"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={VAI_TRO_OPTIONS}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên đăng nhập</FormLabel>
              <FormControl>
                <Input placeholder="nguyenvana (tùy chọn)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Số điện thoại</FormLabel>
              <FormControl>
                <Input placeholder="0901234567 (tùy chọn)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Để trống để hệ thống tự tạo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
            Hủy
          </Button>
        </div>
      </form>
    </Form>
  );
}
