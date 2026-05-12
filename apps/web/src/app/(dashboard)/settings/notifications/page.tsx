import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Separator } from '@/components/ui/separator';
import { NotificationPrefsForm } from '@/components/features/notifications/NotificationPrefsForm';
import { getNotificationPrefsAction } from '@/actions/notifications';

export const metadata: Metadata = { title: 'Cài đặt thông báo' };

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const prefs = await getNotificationPrefsAction();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thông báo</h1>
        <p className="text-muted-foreground text-sm">Chọn loại thông báo bạn muốn nhận.</p>
      </div>

      <Separator />

      <NotificationPrefsForm initialPrefs={prefs} />
    </div>
  );
}
