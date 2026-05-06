'use client';

import { useRef, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { updateProfileAction } from '@/actions/users';
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
import type { UserRole, UserStatus } from '@prisma/client';

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
      const result = await updateProfileAction(values);
      if (result.success) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Avatar + info card */}
      <Card>
        <CardContent className="pt-6 flex gap-5 items-center">
          {/* Avatar với nút upload */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group relative h-20 w-20 rounded-full overflow-hidden ring-2 ring-border focus-visible:outline-none focus-visible:ring-ring"
              aria-label="Đổi ảnh đại diện"
            >
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </span>
              )}
              {/* Overlay khi hover */}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
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
          <div className="space-y-1.5 min-w-0">
            <p className="font-semibold text-base truncate">{displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
              {user.lastLoginAt && (
                <span className="text-xs text-muted-foreground">
                  Đăng nhập lần cuối:{' '}
                  {new Date(user.lastLoginAt).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={pending}
            >
              Hủy
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
