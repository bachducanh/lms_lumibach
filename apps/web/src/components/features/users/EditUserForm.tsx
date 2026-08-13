'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
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
import { TRANG_THAI_OPTIONS, VAI_TRO_OPTIONS } from './CreateUserForm';
import type { UserRole, UserStatus } from '@lumibach/db';

const schema = z.object({
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự').optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'TA', 'STUDENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  phone: z.string().optional(),
  username: z.string().min(3, 'Tối thiểu 3 ký tự').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

type UserData = {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
};

export function EditUserForm({ user }: { user: UserData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user.fullName ?? `${user.firstName} ${user.lastName}`,
      role: user.role,
      status: user.status,
      phone: user.phone ?? '',
      username: user.username ?? '',
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await apiClient.patch(`/users/${user.id}`, values);
        toast.success('Cập nhật thành công.');
        router.push('/admin/users');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật');
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ và tên</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Vai trò</FormLabel>
              <FormControl>
                <SimpleSelect
                  className="w-full"
                  aria-label="Vai trò"
                  value={field.value ?? ''}
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
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trạng thái</FormLabel>
              <FormControl>
                <SimpleSelect
                  className="w-full"
                  aria-label="Trạng thái"
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  options={TRANG_THAI_OPTIONS}
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
                <Input placeholder="(tùy chọn)" {...field} />
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
                <Input placeholder="(tùy chọn)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
            Hủy
          </Button>
        </div>
      </form>
    </Form>
  );
}
