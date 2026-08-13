import Link from 'next/link';
import { Clock, MapPin, Package, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoomListItem } from '@lumibach/types';

export function RoomCard({ room }: { room: RoomListItem }) {
  return (
    <Link
      href={`/rooms/${room.code}`}
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{room.name}</CardTitle>
            {!room.isActive && <Badge variant="secondary">Đang ẩn</Badge>}
          </div>
          {room.description && (
            <p className="text-muted-foreground line-clamp-2 text-sm">{room.description}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-2 text-sm">
          {room.location && (
            <p className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {room.location}
            </p>
          )}
          {room.capacity !== null && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0" />
              Sức chứa {room.capacity} chỗ
            </p>
          )}
          <p className="text-muted-foreground flex items-center gap-2">
            <Package className="h-3.5 w-3.5 shrink-0" />
            {room.equipmentCount} loại thiết bị
          </p>

          {/* Chỉ admin nhận được số này từ API; vai trò khác luôn là null. */}
          {room.pendingBookingCount !== null && room.pendingBookingCount > 0 && (
            <Badge variant="warning" className="mt-1">
              <Clock className="h-3 w-3" />
              {room.pendingBookingCount} đơn chờ duyệt
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
