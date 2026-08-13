'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { z } from 'zod';
import type { StaffProfileDto } from '@lumibach/types';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Ô trống trên form là chuỗi rỗng; API nhận null. Quy đổi khi submit.
const schema = z.object({
  staffCode: z.string().trim().max(50, 'Mã nhân viên tối đa 50 ký tự'),
  department: z.string().trim().max(150, 'Tổ chuyên môn tối đa 150 ký tự'),
});

type FormValues = z.infer<typeof schema>;

/**
 * Hồ sơ công tác dùng cho module Phòng chức năng. Giáo viên tự điền; form đăng
 * ký mượn phòng sẽ tự điền sẵn từ đây và vẫn cho sửa từng đơn.
 */
export function StaffProfileCard({ profile }: { profile: StaffProfileDto }) {
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      staffCode: profile.staffCode ?? '',
      department: profile.department ?? '',
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await apiClient.patch<StaffProfileDto>('/staff-profile', {
          staffCode: values.staffCode.trim() || null,
          department: values.department.trim() || null,
        });
        toast.success('Đã lưu hồ sơ công tác');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được, thử lại sau');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4" />
          Hồ sơ công tác
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Dùng để điền sẵn khi bạn đăng ký mượn phòng chức năng.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã nhân viên</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: GV0123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tổ chuyên môn</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Tổ Toán - Tin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu hồ sơ công tác
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
