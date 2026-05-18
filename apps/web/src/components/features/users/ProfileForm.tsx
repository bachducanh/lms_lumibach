'use client';

import { useRef, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UserRole, UserStatus } from '@lumibach/db';

const schema = z.object({
  fullName: z.string().min(2, 'Tối thiểu 2 ký tự').optional(),
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
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  avatar?: string | null;
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  TA: 'Trợ giảng',
  STUDENT: 'Học sinh',
};

export function ProfileForm({ user }: { user: UserData }) {
  const { update: updateSession } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = user.fullName ?? `${user.firstName} ${user.lastName}`;
  const initials = (displayName[0] ?? '?').toUpperCase();
  const currentAvatar = avatarPreview ?? avatarUrl;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: displayName,
      phone: user.phone ?? '',
      username: user.username ?? '',
    },
  });

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview ngay lập tức
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const json = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !json.url) {
        toast.error(json.error ?? 'Upload thất bại');
        setAvatarPreview(null);
      } else {
        setAvatarUrl(json.url);
        setAvatarPreview(null);
        toast.success('Ảnh đại diện đã được cập nhật');
        await updateSession({ image: json.url });
        router.refresh();
      }
    } catch {
      toast.error('Không thể kết nối server');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await apiClient.patch('/users/me/profile', values);
        toast.success('Hồ sơ đã được cập nhật.');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật hồ sơ');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Avatar + info card */}
      <Card>
        <CardContent className="flex items-center gap-5 pt-6">
          {/* Avatar với nút upload */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group ring-border focus-visible:ring-ring relative h-20 w-20 overflow-hidden rounded-full ring-2 focus-visible:outline-none"
              aria-label="Đổi ảnh đại diện"
            >
              {currentAvatar ? (
                <img src={currentAvatar} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="bg-primary text-primary-foreground flex h-full w-full items-center justify-center text-2xl font-bold">
                  {initials}
                </span>
              )}
              {/* Overlay khi hover */}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* User info */}
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-base font-semibold">{displayName}</p>
            <p className="text-muted-foreground truncate text-sm">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
              {user.lastLoginAt && (
                <span className="text-muted-foreground text-xs">
                  Đăng nhập lần cuối: {new Date(user.lastLoginAt).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Nhấn vào ảnh để thay đổi (JPG, PNG, WebP · tối đa 5 MB)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profile fields */}
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
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Cập nhật hồ sơ
            </Button>
            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={pending}>
              Hủy
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
