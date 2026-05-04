import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import { Bell, Settings } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { NotificationsPageClient } from '@/components/features/notifications/NotificationsPageClient';

export const metadata = { title: 'Thông báo' };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-violet-500" />
          <h1 className="text-xl font-bold">Thông báo</h1>
        </div>
        <Link
          href="/settings/notifications"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <Settings className="h-4 w-4 mr-1.5" />
          Cài đặt
        </Link>
      </div>

      <NotificationsPageClient />
    </div>
  );
}
