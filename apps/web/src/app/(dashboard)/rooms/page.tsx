import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CalendarCheck, DoorOpen, RefreshCw } from 'lucide-react';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { RoomCard } from '@/components/features/rooms/RoomCard';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@lumibach/db';
import type { RoomListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phòng chức năng' };

function getErrorMessage(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.';
    if (err.status === 403) return 'Bạn không có quyền xem phòng chức năng.';
    return err.message;
  }
  return 'Không kết nối được API. Kiểm tra backend ở cổng 4000 rồi tải lại trang.';
}

export default async function RoomsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // Chặn ở FE cho gọn trải nghiệm; lớp chặn thật nằm ở @Roles của RoomsController.
  const role = session.user.role as UserRole | undefined;
  if (!hasMinRole(role, 'TA')) redirect('/dashboard');

  const api = apiServerClient(await cookies());

  let rooms: RoomListItem[] = [];
  let loadError: string | null = null;

  try {
    rooms = await api.get<RoomListItem[]>('/rooms');
  } catch (err) {
    loadError = getErrorMessage(err);
  }

  return (
    <div className="lb-stagger w-full space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        style={{ ['--i' as string]: 0 }}
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <DoorOpen className="h-6 w-6" />
            Phòng chức năng
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Đăng ký mượn phòng và mượn thiết bị theo khung giờ.
          </p>
        </div>
        <Link href="/rooms/bookings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <CalendarCheck className="mr-2 h-4 w-4" />
          Đơn của tôi
        </Link>
      </div>

      {loadError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-5 py-4"
          style={{ ['--i' as string]: 1 }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Không tải được danh sách phòng</p>
                <p className="mt-1 text-sm opacity-90">{loadError}</p>
              </div>
            </div>
            <Link href="/rooms" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tải lại
            </Link>
          </div>
        </div>
      )}

      {!loadError && rooms.length === 0 && (
        <div
          className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center"
          style={{ ['--i' as string]: 1 }}
        >
          <DoorOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">Chưa có phòng chức năng nào</p>
          <p className="mt-1 text-sm">
            Quản trị viên cần tạo phòng trước khi giáo viên có thể đăng ký mượn.
          </p>
        </div>
      )}

      {rooms.length > 0 && (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          style={{ ['--i' as string]: 1 }}
        >
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
