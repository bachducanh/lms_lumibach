import type { Metadata } from 'next';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordForm } from '@/components/features/auth/ChangePasswordForm';

export const metadata: Metadata = { title: 'Bảo mật' };

export default function SecuritySettingsPage() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Bảo mật</h1>
        <p className="text-muted-foreground mt-1 text-sm">Quản lý mật khẩu và bảo mật tài khoản.</p>
      </div>

      <Separator />

      <div className="space-y-1">
        <h2 className="text-lg font-bold sm:text-xl">Đổi mật khẩu</h2>
        <p className="text-muted-foreground text-sm">
          Sau khi đổi, bạn cần đăng nhập lại ở các thiết bị khác.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
