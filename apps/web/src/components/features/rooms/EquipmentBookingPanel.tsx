'use client';

import { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import type { RoomDetail, StaffProfileDto } from '@lumibach/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EquipmentBookingFormDialog } from './EquipmentBookingFormDialog';

export function EquipmentBookingPanel({
  room,
  staffProfile,
  defaultFullName,
}: {
  room: RoomDetail;
  staffProfile: StaffProfileDto | null;
  defaultFullName: string;
}) {
  const [open, setOpen] = useState(false);
  const activeEquipment = room.equipment.filter((item) => item.isActive && item.totalQuantity > 0);

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Thiết bị của phòng
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} disabled={activeEquipment.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Mượn thiết bị
        </Button>
      </CardHeader>
      <CardContent>
        {room.equipment.length === 0 ? (
          <p className="text-muted-foreground text-sm">Phòng này chưa khai báo thiết bị nào.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {room.equipment.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.name}</p>
                    {!item.isActive && <Badge variant="secondary">Đang ẩn</Badge>}
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground text-xs">{item.description}</p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {item.totalQuantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {open && (
        <EquipmentBookingFormDialog
          room={{ ...room, equipment: activeEquipment }}
          staffProfile={staffProfile}
          defaultFullName={defaultFullName}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      )}
    </Card>
  );
}
