import type { Metadata } from 'next';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'Tổng quan',
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground">
          Xin chào, <span className="font-medium text-foreground">{user?.name ?? user?.email}</span>!
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Dashboard widgets sẽ được xây dựng ở các tuần tiếp theo.
        </p>
      </div>
    </div>
  );
}
