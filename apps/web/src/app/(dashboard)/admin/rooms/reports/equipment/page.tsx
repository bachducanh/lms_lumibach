import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { EquipmentReportsWorkspace } from '@/components/features/rooms/EquipmentReportsWorkspace';
import { RoomsAdminTabs } from '@/components/features/rooms/RoomsAdminTabs';
import type { UserRole } from '@lumibach/db';
import type { RoomListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Báo cáo mượn thiết bị' };

export default async function EquipmentReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session.user.role as UserRole | undefined)) redirect('/dashboard');

  // Danh sách phòng chỉ để đổ vào bộ lọc; phòng đã ẩn vẫn cần có mặt vì thiết
  // bị cũ của phòng đó vẫn nằm trong báo cáo.
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
        <h1 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <PackageSearch className="text-primary h-6 w-6 shrink-0" />
          Báo cáo mượn thiết bị
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tần suất mượn, thiết bị đang ngoài kho hoặc quá hạn trả, và đơn không đến nhận.
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
          <EquipmentReportsWorkspace rooms={rooms} />
        )}
      </div>
    </div>
  );
}
