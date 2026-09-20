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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Bell className="h-5 w-5" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Thông báo</h1>
        </div>
        <Link href="/settings/notifications" className={buttonVariants({ variant: 'outline' })}>
          <Settings className="mr-1.5 h-4 w-4" />
          Cài đặt
        </Link>
      </div>

      <NotificationsPageClient />
    </div>
  );
}
