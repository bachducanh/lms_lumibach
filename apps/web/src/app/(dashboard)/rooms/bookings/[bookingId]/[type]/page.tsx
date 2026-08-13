import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, DoorOpen, LogOut } from 'lucide-react';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { HandoverForm } from '@/components/features/rooms/HandoverForm';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@lumibach/db';
import type {
  BookingHandoverSummary,
  HandoverFieldDto,
  RoomBookingDetail,
  RoomDetail,
} from '@lumibach/types';

export const dynamic = 'force-dynamic';

/** Chỉ nhận hai giá trị; đường dẫn khác thì 404 chứ không đoán bừa. */
const LOAI_HOP_LE = { checkin: 'CHECKIN', checkout: 'CHECKOUT' } as const;

type Params = Promise<{ bookingId: string; type: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { type } = await params;
  return { title: type === 'checkout' ? 'Trả phòng' : 'Nhận phòng' };
}

export default async function HandoverPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!hasMinRole(session.user.role as UserRole | undefined, 'TA')) redirect('/dashboard');

  const { bookingId, type } = await params;
  const loai = LOAI_HOP_LE[type as keyof typeof LOAI_HOP_LE];
  if (!loai) notFound();

  const api = apiServerClient(await cookies());

  let booking: RoomBookingDetail;
  let fields: HandoverFieldDto[];
  let summary: BookingHandoverSummary;
  let room: RoomDetail;

  try {
    booking = await api.get<RoomBookingDetail>(`/room-bookings/${bookingId}`);
    [fields, summary, room] = await Promise.all([
      api.get<HandoverFieldDto[]>(`/room-bookings/${bookingId}/handover-fields/${type}`),
      api.get<BookingHandoverSummary>(`/room-bookings/${bookingId}/handovers`),
      api.get<RoomDetail>(`/rooms/${encodeURIComponent(booking.roomCode)}`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }

  // Chặn sớm ở đây cho gọn trải nghiệm; lớp chặn thật vẫn là state machine ở API.
  const hanhDong = loai === 'CHECKIN' ? 'checkin' : 'checkout';
  const lamDuoc = booking.availableActions.includes(hanhDong);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div>
        <Link
          href="/rooms/bookings"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-2 -ml-2' })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Đơn của tôi
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {loai === 'CHECKIN' ? <DoorOpen className="h-6 w-6" /> : <LogOut className="h-6 w-6" />}
          {loai === 'CHECKIN' ? 'Nhận phòng' : 'Trả phòng'}
        </h1>
      </div>

      {lamDuoc ? (
        <HandoverForm
          booking={booking}
          fields={fields}
          summary={summary}
          type={loai}
          photoLimits={{
            min: room.setting.minPhotosPerHandover,
            max: room.setting.maxPhotosPerHandover,
          }}
        />
      ) : (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          <p className="font-medium">
            {loai === 'CHECKIN' ? 'Đơn này chưa nhận phòng được' : 'Đơn này chưa trả phòng được'}
          </p>
          <p className="mt-1">
            {loai === 'CHECKIN'
              ? 'Đơn phải được Quản trị viên duyệt trước, và chỉ người mượn mới nhận phòng được.'
              : 'Bạn cần nhận phòng trước khi trả phòng.'}
          </p>
        </div>
      )}
    </div>
  );
}
