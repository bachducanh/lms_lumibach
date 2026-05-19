import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/layouts/Sidebar';
import { Header } from '@/components/layouts/Header';
import { SidebarProvider } from '@/components/layouts/SidebarContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // All routes nested under (dashboard) require auth — bounce anonymous
  // visitors to the login page (landing page is at `/`).
  if (!session?.user) redirect('/login');

  // Defensive check: the session JWT may reference a user that no longer
  // exists in the database (DB reset, account deleted, env switched, …).
  // Every downstream API call would then fail with "User not found" and
  // the UI shows confusing errors. Verify the user exists here, and bounce
  // to a route handler that clears the stale cookies then redirects to
  // /login (we can't delete cookies from a Server Component directly).
  // Only Prisma errors are caught — `redirect()` throws by design.
  let userOk: boolean | null = null;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id, deletedAt: null },
      select: { id: true, status: true },
    });
    userOk = !!dbUser && dbUser.status === 'ACTIVE';
  } catch {
    // DB unreachable — render normally so user sees the API error rather
    // than getting trapped in a /login that also can't authenticate.
    userOk = null;
  }
  if (userOk === false) {
    redirect('/api/auth/stale-bounce?reason=session-stale');
  }

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
