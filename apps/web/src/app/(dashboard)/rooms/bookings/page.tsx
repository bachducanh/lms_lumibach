import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarCheck, ChevronLeft, Package } from 'lucide-react';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { MyBookingsList } from '@/components/features/rooms/MyBookingsList';
import { MyEquipmentBookingsList } from '@/components/features/rooms/MyEquipmentBookingsList';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@lumibach/db';
import type { EquipmentBookingListItem, RoomBookingListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Đơn mượn phòng của tôi' };

/** Khoảng thời gian lấy đơn: 3 tháng trước tới 6 tháng sau. */
const LUI_LAI_NGAY = 90;
const TIEN_TOI_NGAY = 180;

export default async function MyRoomBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const role = session.user.role as UserRole | undefined;
  if (!hasMinRole(role, 'TA')) redirect('/dashboard');

  const now = Date.now();
  const from = new Date(now - LUI_LAI_NGAY * 86_400_000).toISOString();
  const to = new Date(now + TIEN_TOI_NGAY * 86_400_000).toISOString();

  const api = apiServerClient(await cookies());
  let bookings: RoomBookingListItem[] = [];
  let equipmentBookings: EquipmentBookingListItem[] = [];
  let loadError: string | null = null;

  try {
    [bookings, equipmentBookings] = await Promise.all([
      api.get<RoomBookingListItem[]>(`/room-bookings?from=${from}&to=${to}&mine=true`),
      api.get<EquipmentBookingListItem[]>(`/equipment-bookings?from=${from}&to=${to}&mine=true`),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được danh sách đơn của bạn.';
  }

  return (
    <div className="lb-stagger mx-auto max-w-4xl space-y-6">
      <div style={{ ['--i' as string]: 0 }}>
        <Link
          href="/rooms"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-2 -ml-2' })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Phòng chức năng
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarCheck className="h-6 w-6" />
          Đơn mượn phòng của tôi
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Các đơn trong 3 tháng qua và 6 tháng tới.
        </p>
      </div>

      <div style={{ ['--i' as string]: 1 }}>
        {loadError ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-5 py-4 text-sm"
          >
            {loadError}
          </p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarCheck className="h-5 w-5" />
                Đơn mượn phòng
              </h2>
              <MyBookingsList bookings={bookings} />
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Package className="h-5 w-5" />
                Đơn mượn thiết bị
              </h2>
              <MyEquipmentBookingsList bookings={equipmentBookings} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
