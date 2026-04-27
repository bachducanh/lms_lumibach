'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Loader2, KeyRound } from 'lucide-react';
import { changePasswordAction } from '@/actions/auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Cần có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Cần có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function handleCancel() {
    setOpen(false);
    setConfirm(false);
    setError(null);
    reset();
  }

  async function onConfirm() {
    setPending(true);
    setError(null);
    const res = await changePasswordAction(getValues());
    setPending(false);
    if (res.success) {
      toast.success(res.message);
      handleCancel();
    } else {
      setConfirm(false);
      setError(res.error);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" />
        Đổi mật khẩu
      </Button>
    );
  }

  return (
    <>
      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-card p-6 shadow-xl w-80 space-y-4 ring-1 ring-foreground/10">
            <p className="font-semibold">Xác nhận đổi mật khẩu?</p>
            <p className="text-sm text-muted-foreground">
              Bạn sẽ cần đăng nhập lại bằng mật khẩu mới sau khi thay đổi.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>
                Hủy
              </Button>
              <Button size="sm" disabled={pending} onClick={onConfirm}>
                {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(() => setConfirm(true))}
        className="space-y-4 max-w-sm"
      >
        {error && (
          <Alert className="border-destructive/50 text-destructive text-sm py-2 px-3">
            {error}
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
          />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Mật khẩu mới</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register('newPassword')}
          />
          {errors.newPassword ? (
            <p className="text-xs text-destructive">{errors.newPassword.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tối thiểu 8 ký tự, có chữ hoa và chữ số
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit">Tiếp tục</Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Hủy
          </Button>
        </div>
      </form>
    </>
  );
}
