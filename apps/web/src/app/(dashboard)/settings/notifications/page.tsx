import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Separator } from '@/components/ui/separator';
import { NotificationPrefsForm } from '@/components/features/notifications/NotificationPrefsForm';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { NotificationPrefs } from '@lumibach/types';

const DEFAULT_PREFS: NotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  emailQuizGraded: true,
  emailAssignmentGraded: true,
  emailCodeGraded: true,
  emailEnrolled: true,
  emailDueSoon: true,
};

export const metadata: Metadata = { title: 'Cài đặt thông báo' };

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const api = apiServerClient(await cookies());
  const prefs = await api
    .get<NotificationPrefs>('/notifications/preferences')
    .catch((err: unknown) => {
      if (err instanceof ApiError) return DEFAULT_PREFS;
      throw err;
    });

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Thông báo</h1>
        <p className="text-muted-foreground mt-1 text-sm">Chọn loại thông báo bạn muốn nhận.</p>
      </div>

      <Separator />

      <NotificationPrefsForm initialPrefs={prefs} />
    </div>
  );
}
