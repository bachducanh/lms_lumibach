'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createUserAction } from '@/actions/users';
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
      const result = await createUserAction(values);
      if (result.success) {
        toast.success(result.message);
        if (result.data) setGeneratedPassword(result.data.password);
      } else {
        toast.error(result.error);
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, msgs]) => {
            form.setError(field as keyof FormValues, { message: (msgs as string[])[0] });
          });
        }
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
          <p className="text-sm text-muted-foreground">Mật khẩu tạm thời:</p>
          <code className="block bg-muted px-4 py-3 rounded-lg text-lg font-mono font-bold tracking-wider">
            {generatedPassword}
          </code>
          <p className="text-xs text-muted-foreground">
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
                <select
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-card"
                  value={field.value}
                  onChange={field.onChange}
                >
                  <option value="STUDENT">Học sinh</option>
                  <option value="TA">Trợ giảng (TA)</option>
                  <option value="TEACHER">Giáo viên</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
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
