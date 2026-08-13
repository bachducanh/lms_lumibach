import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DoorOpen } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { AdminRoomsManager } from '@/components/features/rooms/AdminRoomsManager';
import { RoomsAdminTabs } from '@/components/features/rooms/RoomsAdminTabs';
import type { UserRole } from '@lumibach/db';
import type { RoomListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản trị phòng chức năng' };

export default async function AdminRoomsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session.user.role as UserRole | undefined)) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  let rooms: RoomListItem[] = [];
  let loadError: string | null = null;

  try {
    rooms = await api.get<RoomListItem[]>('/rooms?includeInactive=true');
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được danh sách phòng.';
  }

  return (
    <div className="lb-stagger w-full space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <DoorOpen className="h-6 w-6" />
          Quản trị phòng chức năng
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Khai báo phòng, thiết bị, nội quy, tham số đặt phòng và trường bàn giao.
        </p>
      </div>

      <RoomsAdminTabs />

      <div style={{ ['--i' as string]: 1 }}>
        {loadError ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-5 py-4 text-sm"
          >
            {loadError}
          </p>
        ) : (
          <AdminRoomsManager rooms={rooms} />
        )}
      </div>
    </div>
  );
}
