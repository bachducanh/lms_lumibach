import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft, MapPin, ScrollText, Users } from 'lucide-react';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { RoomCalendar } from '@/components/features/rooms/RoomCalendar';
import { EquipmentBookingPanel } from '@/components/features/rooms/EquipmentBookingPanel';
import type { UserRole } from '@lumibach/db';
import type { RoomDetail, StaffProfileDto } from '@lumibach/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Phòng chức năng · ${code}` };
}

export default async function RoomDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const role = session.user.role as UserRole | undefined;
  if (!hasMinRole(role, 'TA')) redirect('/dashboard');

  const { code } = await params;
  const api = apiServerClient(await cookies());

  let room: RoomDetail;
  try {
    room = await api.get<RoomDetail>(`/rooms/${encodeURIComponent(code)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Dùng để điền sẵn form đăng ký; thiếu hồ sơ thì form vẫn nhập tay được.
  const staffProfile = await api.get<StaffProfileDto>('/staff-profile').catch(() => null);

  return (
    <div className="lb-stagger w-full space-y-6">
      <div style={{ ['--i' as string]: 0 }}>
        <Link
          href="/rooms"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-2 -ml-2' })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Tất cả phòng
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{room.name}</h1>
          {!room.isActive && <Badge variant="secondary">Đang ẩn</Badge>}
        </div>

        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {room.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {room.location}
            </span>
          )}
          {room.capacity !== null && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Sức chứa {room.capacity} chỗ
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Giờ mở cửa {room.setting.openTime} – {room.setting.closeTime}
          </span>
        </div>

        {room.description && <p className="mt-3 text-sm">{room.description}</p>}
      </div>

      <div style={{ ['--i' as string]: 1 }}>
        <RoomCalendar
          room={room}
          staffProfile={staffProfile}
          defaultFullName={session.user.name ?? ''}
        />
      </div>

      <div style={{ ['--i' as string]: 2 }}>
        <EquipmentBookingPanel
          room={room}
          staffProfile={staffProfile}
          defaultFullName={session.user.name ?? ''}
        />
      </div>

      <Card style={{ ['--i' as string]: 3 }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            Nội quy phòng
            {room.currentRule && <Badge variant="outline">Bản {room.currentRule.version}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {room.currentRule ? (
            <RichTextView html={room.currentRule.content} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Quản trị viên chưa soạn nội quy cho phòng này.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
