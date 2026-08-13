import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PackageCheck } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { PendingEquipmentBookingsQueue } from '@/components/features/rooms/PendingEquipmentBookingsQueue';
import { RoomsAdminTabs } from '@/components/features/rooms/RoomsAdminTabs';
import type { UserRole } from '@lumibach/db';
import type { PendingEquipmentBookingItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hàng chờ duyệt thiết bị' };

export default async function AdminEquipmentBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdmin(session.user.role as UserRole | undefined)) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  let pending: PendingEquipmentBookingItem[] = [];
  let loadError: string | null = null;

  try {
    pending = await api.get<PendingEquipmentBookingItem[]>('/equipment-bookings/pending');
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được hàng chờ duyệt thiết bị.';
  }

  return (
    <div className="lb-stagger w-full space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <PackageCheck className="h-6 w-6" />
          Hàng chờ duyệt thiết bị
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Đơn mượn thiết bị đang chờ duyệt, kèm cảnh báo nếu không đủ số lượng.
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
          <PendingEquipmentBookingsQueue bookings={pending} />
        )}
      </div>
    </div>
  );
}
