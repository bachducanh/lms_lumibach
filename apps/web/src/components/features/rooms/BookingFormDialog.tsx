'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  formatHHmm,
  parseHHmm,
  vnDateKey,
  vnDateTimeToUtc,
  vnTimeLabel,
  type RoomBookingDetail,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type BookingFormInitial = {
  /** Có id = đang sửa đơn cũ; không có = tạo mới. */
  bookingId?: string;
  startAt: Date;
  endAt: Date;
  fullName?: string;
  staffCode?: string | null;
  department?: string | null;
  reason?: string;
  /** Hồ sơ công tác để điền sẵn khi tạo đơn mới. */
  staffProfile: StaffProfileDto | null;
  /** Họ tên từ hồ sơ người dùng, dùng khi tạo đơn mới. */
  defaultFullName: string;
};

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Vui lòng nhập họ và tên'),
    staffCode: z.string().trim().max(50),
    department: z.string().trim().max(150),
    reason: z.string().trim().min(5, 'Vui lòng ghi rõ lý do mượn phòng (tối thiểu 5 ký tự)'),
    date: z.string().min(1, 'Chọn ngày'),
    startTime: z.string().min(1, 'Chọn giờ bắt đầu'),
    endTime: z.string().min(1, 'Chọn giờ kết thúc'),
  })
  .refine(
    (v) => {
      const tu = parseHHmm(v.startTime);
      const den = parseHHmm(v.endTime);
      return tu !== null && den !== null && den > tu;
    },
    { message: 'Giờ kết thúc phải sau giờ bắt đầu', path: ['endTime'] }
  );

type FormValues = z.infer<typeof schema>;

export function BookingFormDialog({
  room,
  initial,
  onClose,
  onSaved,
}: {
  room: RoomDetail;
  initial: BookingFormInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [loiMayChu, setLoiMayChu] = useState<string | null>(null);
  const dangSua = Boolean(initial.bookingId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Ưu tiên dữ liệu của đơn đang sửa; tạo mới thì lấy từ hồ sơ người dùng
      // và hồ sơ công tác. Mọi ô đều cho sửa lại cho từng đơn.
      fullName: initial.fullName ?? initial.defaultFullName,
      staffCode: initial.staffCode ?? initial.staffProfile?.staffCode ?? '',
      department: initial.department ?? initial.staffProfile?.department ?? '',
      reason: initial.reason ?? '',
      date: vnDateKey(initial.startAt),
      startTime: vnTimeLabel(initial.startAt),
      endTime: vnTimeLabel(initial.endAt),
    },
  });

  function onSubmit(values: FormValues) {
    setLoiMayChu(null);

    const tuPhut = parseHHmm(values.startTime) as number;
    const denPhut = parseHHmm(values.endTime) as number;
    const startAt = vnDateTimeToUtc(values.date, tuPhut).toISOString();
    const endAt = vnDateTimeToUtc(values.date, denPhut).toISOString();

    const body = {
      fullName: values.fullName,
      staffCode: values.staffCode.trim() || null,
      department: values.department.trim() || null,
      reason: values.reason,
      startAt,
      endAt,
    };

    startTransition(async () => {
      try {
        if (dangSua) {
          await apiClient.patch<RoomBookingDetail>(`/room-bookings/${initial.bookingId}`, body);
          toast.success('Đã cập nhật đơn');
        } else {
          await apiClient.post<RoomBookingDetail>('/room-bookings', { ...body, roomId: room.id });
          toast.success('Đã gửi đơn, chờ Quản trị viên duyệt');
        }
        onSaved();
      } catch (err) {
        // Lỗi trùng giờ và lỗi ràng buộc lịch cần hiện ngay trong hộp thoại,
        // toast trôi mất thì người dùng không biết sửa gì.
        setLoiMayChu(
          err instanceof ApiError ? err.message : 'Không gửi được đơn, vui lòng thử lại.'
        );
      }
    });
  }

  const gioMo = parseHHmm(room.setting.openTime);
  const gioDong = parseHHmm(room.setting.closeTime);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dangSua ? 'Sửa đơn mượn phòng' : 'Đăng ký mượn phòng'}</DialogTitle>
          <DialogDescription>
            {room.name}
            {gioMo !== null && gioDong !== null && (
              <>
                {' '}
                · Giờ mở cửa {formatHHmm(gioMo)}–{formatHHmm(gioDong)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="staffCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã nhân viên</FormLabel>
                    <FormControl>
                      <Input placeholder="GV0123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tổ chuyên môn</FormLabel>
                    <FormControl>
                      <Input placeholder="Tổ Toán - Tin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giờ bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="time" step={room.setting.slotStepMinutes * 60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giờ kết thúc</FormLabel>
                    <FormControl>
                      <Input type="time" step={room.setting.slotStepMinutes * 60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lý do mượn phòng</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="VD: Dạy thực hành Tin học lớp 10A1, tiết 3–4"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {dangSua && (
              <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-xs">
                Đổi ngày hoặc giờ sẽ đưa đơn về trạng thái chờ duyệt lại.
              </p>
            )}

            {loiMayChu && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loiMayChu}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Đóng
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dangSua ? 'Lưu thay đổi' : 'Gửi đơn'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
