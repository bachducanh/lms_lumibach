'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateUserAction } from '@/actions/users';
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
import type { UserRole, UserStatus } from '@prisma/client';

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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-card';

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
      const result = await updateUserAction(user.id, values);
      if (result.success) {
        toast.success(result.message);
        router.push('/admin/users');
      } else {
        toast.error(result.error);
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
                <select className={selectClass} value={field.value} onChange={field.onChange}>
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
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trạng thái</FormLabel>
              <FormControl>
                <select className={selectClass} value={field.value} onChange={field.onChange}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Không hoạt động</option>
                  <option value="SUSPENDED">Tạm khóa</option>
                  <option value="PENDING">Chờ xác thực</option>
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
