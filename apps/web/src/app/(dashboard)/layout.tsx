import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layouts/Sidebar';
import { Header } from '@/components/layouts/Header';
import { SidebarProvider } from '@/components/layouts/SidebarContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // All routes nested under (dashboard) require auth — bounce anonymous
  // visitors to the login page (landing page is at `/`).
  if (!session?.user) redirect('/login');

  return (
    <SessionProvider session={session}>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header showNotifications={!!session?.user} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
