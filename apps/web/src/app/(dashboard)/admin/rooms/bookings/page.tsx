import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { ApprovalCalendar } from '@/components/features/rooms/ApprovalCalendar';
import { PendingBookingsQueue } from '@/components/features/rooms/PendingBookingsQueue';
import { RoomsAdminTabs } from '@/components/features/rooms/RoomsAdminTabs';
import type { UserRole } from '@lumibach/db';
import type { PendingBookingItem, RoomListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hàng chờ duyệt phòng' };

export default async function AdminRoomBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session.user.role as UserRole | undefined)) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  let pending: PendingBookingItem[] = [];
  let rooms: RoomListItem[] = [];
  let loadError: string | null = null;

  try {
    [pending, rooms] = await Promise.all([
      api.get<PendingBookingItem[]>('/room-bookings/pending'),
      api.get<RoomListItem[]>('/rooms?includeInactive=true'),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được hàng chờ duyệt.';
  }

  return (
    <div className="lb-stagger w-full space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardCheck className="h-6 w-6" />
          Hàng chờ duyệt phòng
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Đơn mượn phòng đang chờ bạn duyệt, sắp theo thời gian sử dụng.
        </p>
      </div>

      <RoomsAdminTabs />

      {loadError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-5 py-4 text-sm"
          style={{ ['--i' as string]: 1 }}
        >
          {loadError}
        </p>
      ) : (
        <>
          {/* Lịch là khung nhìn chính: duyệt hay không phụ thuộc vào bối cảnh
              cả tuần, nên phải thấy được các đơn xung quanh. */}
          <section style={{ ['--i' as string]: 1 }}>
            <ApprovalCalendar rooms={rooms} />
          </section>

          {/* Danh sách giữ lại cho thao tác duyệt nhiều đơn một lượt — việc mà
              lưới lịch làm không tiện. */}
          <section className="space-y-3" style={{ ['--i' as string]: 2 }}>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Duyệt nhiều đơn</h2>
              {pending.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {pending.length} đơn chờ
                </span>
              )}
            </div>
            <PendingBookingsQueue bookings={pending} />
          </section>
        </>
      )}
    </div>
  );
}
