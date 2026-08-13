'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  formatHHmm,
  parseHHmm,
  vnDateKey,
  vnDateTimeToUtc,
  vnMinutesOfDay,
  type EquipmentBookingDetail,
  type RoomDetail,
  type StaffProfileDto,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function EquipmentBookingFormDialog({
  room,
  staffProfile,
  defaultFullName,
  onClose,
  onSaved,
}: {
  room: RoomDetail;
  staffProfile: StaffProfileDto | null;
  defaultFullName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(defaultFullName);
  const [staffCode, setStaffCode] = useState(staffProfile?.staffCode ?? '');
  const [department, setDepartment] = useState(staffProfile?.department ?? '');
  const [reason, setReason] = useState('');
  const [loiMayChu, setLoiMayChu] = useState<string | null>(null);
  const defaults = useMemo(() => defaultWindow(room), [room]);
  const [date, setDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const selectedItems = room.equipment
    .map((item) => ({
      equipmentId: item.id,
      quantity: Number(quantities[item.id] ?? 0),
      max: item.totalQuantity,
      name: item.name,
    }))
    .filter((item) => item.quantity > 0);

  function onSubmit() {
    setLoiMayChu(null);

    if (fullName.trim().length < 2) {
      setLoiMayChu('Vui lòng nhập họ và tên.');
      return;
    }
    if (reason.trim().length < 5) {
      setLoiMayChu('Vui lòng ghi rõ lý do mượn thiết bị.');
      return;
    }
    if (selectedItems.length === 0) {
      setLoiMayChu('Vui lòng chọn ít nhất một thiết bị.');
      return;
    }
    const invalid = selectedItems.find((item) => item.quantity > item.max);
    if (invalid) {
      setLoiMayChu(`${invalid.name} chỉ còn tổng ${invalid.max}.`);
      return;
    }

    const startMinutes = parseHHmm(startTime);
    const endMinutes = parseHHmm(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setLoiMayChu('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    startTransition(async () => {
      try {
        await apiClient.post<EquipmentBookingDetail>('/equipment-bookings', {
          roomId: room.id,
          fullName: fullName.trim(),
          staffCode: staffCode.trim() || null,
          department: department.trim() || null,
          reason: reason.trim(),
          startAt: vnDateTimeToUtc(date, startMinutes).toISOString(),
          endAt: vnDateTimeToUtc(date, endMinutes).toISOString(),
          items: selectedItems.map(({ equipmentId, quantity }) => ({ equipmentId, quantity })),
        });
        toast.success('Đã gửi đơn mượn thiết bị');
        onSaved();
      } catch (err) {
        setLoiMayChu(
          err instanceof ApiError
            ? err.message
            : 'Không gửi được đơn mượn thiết bị, vui lòng thử lại.'
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Đăng ký mượn thiết bị</DialogTitle>
          <DialogDescription>{room.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Mã nhân viên">
              <Input value={staffCode} onChange={(e) => setStaffCode(e.target.value)} />
            </Field>
          </div>

          <Field label="Tổ chuyên môn">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ngày">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Giờ bắt đầu">
              <Input
                type="time"
                step={room.setting.slotStepMinutes * 60}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label="Giờ kết thúc">
              <Input
                type="time"
                step={room.setting.slotStepMinutes * 60}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Lý do mượn thiết bị">
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Mượn dây HDMI và chuột dự phòng cho tiết thực hành"
            />
          </Field>

          <div className="space-y-2">
            <Label>Thiết bị</Label>
            <div className="border-border divide-border divide-y rounded-lg border">
              {room.equipment.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_7rem] items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Tổng {item.totalQuantity} {item.unit}
                      {item.code && ` · ${item.code}`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={item.totalQuantity}
                    value={quantities[item.id] ?? ''}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="0"
                    aria-label={`Số lượng ${item.name}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {loiMayChu && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loiMayChu}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Đóng
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function defaultWindow(room: RoomDetail) {
  const step = room.setting.slotStepMinutes;
  const open = parseHHmm(room.setting.openTime) ?? 7 * 60;
  const close = parseHHmm(room.setting.closeTime) ?? 17 * 60 + 30;
  const now = new Date();
  const current = vnMinutesOfDay(now);
  const rounded = Math.ceil(current / step) * step;
  const start = rounded + room.setting.minDurationMinutes < close ? Math.max(open, rounded) : open;
  const end = Math.min(close, start + room.setting.minDurationMinutes);
  return { date: vnDateKey(now), startTime: formatHHmm(start), endTime: formatHHmm(end) };
}
