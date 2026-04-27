import type { Metadata } from 'next';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordForm } from '@/components/features/auth/ChangePasswordForm';

export const metadata: Metadata = { title: 'Bảo mật' };

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bảo mật</h1>
        <p className="text-muted-foreground text-sm">Quản lý mật khẩu và bảo mật tài khoản.</p>
      </div>

      <Separator />

      <div className="space-y-1">
        <h2 className="text-base font-medium">Đổi mật khẩu</h2>
        <p className="text-sm text-muted-foreground">
          Sau khi đổi, bạn cần đăng nhập lại ở các thiết bị khác.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
