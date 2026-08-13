'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  ROOM_BOOKING_STATUS_LABEL,
  vnDateLabel,
  vnDateTimeLabel,
  vnTimeLabel,
  vnWeekdayLabel,
  type RoomBookingListItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportRowsToExcel, safeExcelFileName } from '@/lib/export-excel';
import { Button } from '@/components/ui/button';

type Props = {
  roomId: string;
  roomName: string;
  /** Mốc đầu và cuối khoảng đang xem trên lịch. */
  from: Date;
  to: Date;
};

/**
 * Xuất báo cáo sử dụng phòng của đúng khoảng thời gian đang hiển thị trên lịch.
 *
 * Tải lại dữ liệu từ máy chủ thay vì dùng mảng đang có trên màn hình: lịch chỉ
 * giữ những đơn khớp bộ lọc hiện tại, còn báo cáo thì phải đủ mọi đơn trong tuần.
 */
export function WeeklyReportButton({ roomId, roomName, from, to }: Props) {
  const [dangXuat, setDangXuat] = useState(false);

  async function xuatBaoCao() {
    setDangXuat(true);
    try {
      const bookings = await apiClient.get<RoomBookingListItem[]>(
        `/room-bookings?roomId=${roomId}&from=${from.toISOString()}&to=${to.toISOString()}`
      );

      if (bookings.length === 0) {
        toast.info('Tuần này chưa có đơn mượn phòng nào để xuất.');
        return;
      }

      const theoThoiGian = [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt));

      const rows: (string | number)[][] = [
        [`BÁO CÁO SỬ DỤNG ${roomName.toUpperCase()}`],
        [`Từ ${vnDateLabel(from)} đến ${vnDateLabel(new Date(to.getTime() - 1))}`],
        [`Xuất lúc ${vnDateTimeLabel(new Date())}`],
        [],
        [
          'STT',
          'Thứ',
          'Ngày',
          'Giờ bắt đầu',
          'Giờ kết thúc',
          'Số giờ',
          'Người mượn',
          'Mã nhân viên',
          'Tổ chuyên môn',
          'Lý do mượn',
          'Trạng thái',
        ],
        ...theoThoiGian.map((b, i) => {
          const start = new Date(b.startAt);
          const end = new Date(b.endAt);
          const soGio = (end.getTime() - start.getTime()) / 3_600_000;
          return [
            i + 1,
            vnWeekdayLabel(start),
            vnDateLabel(start),
            vnTimeLabel(start),
            vnTimeLabel(end),
            Number(soGio.toFixed(2)),
            b.fullName,
            b.staffCode ?? '',
            b.department ?? '',
            b.reason,
            ROOM_BOOKING_STATUS_LABEL[b.status],
          ];
        }),
        [],
        ...dongTongKet(theoThoiGian),
      ];

      await exportRowsToExcel({
        rows,
        fileName: `bao-cao-${safeExcelFileName(roomName)}-tuan-${safeExcelFileName(vnDateLabel(from))}`,
        sheetName: 'Bao cao tuan',
      });

      toast.success(`Đã xuất ${theoThoiGian.length} đơn`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không xuất được báo cáo.');
    } finally {
      setDangXuat(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={xuatBaoCao} disabled={dangXuat}>
      {dangXuat ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="mr-1.5 h-4 w-4" />
      )}
      Xuất Excel
    </Button>
  );
}

/**
 * Phần tổng kết cuối bảng: đếm theo trạng thái và theo tổ chuyên môn — hai con
 * số hay phải báo cáo lên nhất.
 */
function dongTongKet(bookings: RoomBookingListItem[]): (string | number)[][] {
  const theoTrangThai = new Map<string, number>();
  const theoTo = new Map<string, number>();
  let tongGio = 0;

  for (const b of bookings) {
    const nhan = ROOM_BOOKING_STATUS_LABEL[b.status];
    theoTrangThai.set(nhan, (theoTrangThai.get(nhan) ?? 0) + 1);

    const to = b.department?.trim() || '(không ghi tổ)';
    theoTo.set(to, (theoTo.get(to) ?? 0) + 1);

    tongGio += (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000;
  }

  return [
    ['TỔNG KẾT'],
    ['Tổng số đơn', bookings.length],
    ['Tổng số giờ sử dụng', Number(tongGio.toFixed(2))],
    [],
    ['Theo trạng thái', 'Số đơn'],
    ...[...theoTrangThai.entries()].map(([nhan, so]) => [nhan, so]),
    [],
    ['Theo tổ chuyên môn', 'Số đơn'],
    ...[...theoTo.entries()].sort((a, b) => b[1] - a[1]).map(([to, so]) => [to, so]),
  ];
}
