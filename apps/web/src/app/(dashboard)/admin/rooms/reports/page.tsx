import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/permissions';
import { RoomReportsWorkspace } from '@/components/features/rooms/RoomReportsWorkspace';
import { RoomsAdminTabs } from '@/components/features/rooms/RoomsAdminTabs';
import type { UserRole } from '@lumibach/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Báo cáo phòng chức năng' };

export default async function RoomReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session.user.role as UserRole | undefined)) redirect('/dashboard');

  return (
    <div className="lb-stagger w-full space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6" />
          Báo cáo phòng chức năng
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tần suất sử dụng, đơn không đến nhận và bàn giao thiếu số liệu.
        </p>
      </div>

      <RoomsAdminTabs />

      <div style={{ ['--i' as string]: 1 }}>
        <RoomReportsWorkspace />
      </div>
    </div>
  );
}
