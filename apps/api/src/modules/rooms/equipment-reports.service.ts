import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import {
  vnParts,
  type EquipmentBookingItemDto,
  type EquipmentNoShowReportRow,
  type EquipmentOnLoanRow,
  type EquipmentReportGroupBy,
  type EquipmentReportQuery,
  type EquipmentUsageReport,
  type EquipmentUsageReportRow,
  type OutstandingEquipmentQuery,
  type OutstandingEquipmentReport,
  type OutstandingEquipmentRow,
} from '@lumibach/types';
import { doiKhoangBaoCao } from './room-reports.service';

/** Đơn còn đang giữ thiết bị: đã nhận nhưng chưa được xác nhận trả xong. */
const TRANG_THAI_CHUA_TRA_XONG = ['CHECKED_IN', 'CHECKED_OUT'] as const;

const BOOKING_SELECT = {
  id: true,
  roomId: true,
  status: true,
  fullName: true,
  staffCode: true,
  department: true,
  reason: true,
  startAt: true,
  endAt: true,
  room: { select: { name: true } },
  items: {
    select: {
      quantity: true,
      equipment: {
        select: { id: true, name: true, code: true, unit: true, totalQuantity: true },
      },
    },
  },
} as const;

type BookingRow = {
  items: {
    quantity: number;
    equipment: { id: string; name: string; code: string | null; unit: string };
  }[];
};

/**
 * Báo cáo mượn thiết bị.
 *
 * Gom số liệu trong bộ nhớ giống báo cáo phòng (xem `RoomReportsService`), vì
 * cùng lý do: gom theo tháng phải theo giờ Việt Nam.
 *
 * Khác báo cáo phòng ở một điểm quan trọng: một ĐƠN mượn thiết bị chứa nhiều
 * DÒNG thiết bị, nên mỗi báo cáo đều phải nói rõ đang đếm đơn hay đếm số lượng.
 */
@Injectable()
export class EquipmentReportsService {
  constructor(private readonly prisma: PrismaClient) {}

  async usage(query: EquipmentReportQuery): Promise<EquipmentUsageReport> {
    const { from, to } = doiKhoangBaoCao(query);

    const bookings = await this.prisma.equipmentBooking.findMany({
      where: {
        startAt: { gte: from, lt: to },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: BOOKING_SELECT,
      orderBy: { startAt: 'asc' },
    });

    const theoNhom = new Map<string, EquipmentUsageReportRow>();
    let tongDon = 0;
    let tongSoLuong = 0;
    let tongGio = 0;

    for (const b of bookings) {
      const soGio = (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000;
      const soLuongDon = b.items.reduce((tong, item) => tong + item.quantity, 0);

      // Gom theo thiết bị thì MỘT đơn rơi vào nhiều nhóm — mỗi dòng thiết bị
      // một nhóm; các cách gom còn lại thì cả đơn nằm gọn trong một nhóm.
      const phanBo =
        query.groupBy === 'equipment'
          ? b.items.map((item) => ({
              key: item.equipment.id,
              label: nhanThietBi(item.equipment, b.room.name),
              soLuong: item.quantity,
            }))
          : [{ ...this.khoaNhom(query.groupBy, b), soLuong: soLuongDon }];

      for (const phan of phanBo) {
        const dong =
          theoNhom.get(phan.key) ??
          ({
            key: phan.key,
            label: phan.label,
            bookingCount: 0,
            itemQuantity: 0,
            totalHours: 0,
            completedCount: 0,
            noShowCount: 0,
            cancelledCount: 0,
            rejectedCount: 0,
          } satisfies EquipmentUsageReportRow);

        dong.bookingCount += 1;
        dong.itemQuantity += phan.soLuong;
        dong.totalHours += soGio;
        if (b.status === 'COMPLETED') dong.completedCount += 1;
        if (b.status === 'NO_SHOW') dong.noShowCount += 1;
        if (b.status === 'CANCELLED') dong.cancelledCount += 1;
        if (b.status === 'REJECTED') dong.rejectedCount += 1;

        theoNhom.set(phan.key, dong);
      }

      tongDon += 1;
      tongSoLuong += soLuongDon;
      tongGio += soGio;
    }

    const rows = [...theoNhom.values()]
      .map((r) => ({ ...r, totalHours: lamTron(r.totalHours) }))
      // Gom theo tháng thì sắp theo thời gian; còn lại đưa nhóm mượn nhiều
      // nhất lên trước — đó là thứ admin cần thấy đầu tiên.
      .sort((a, b) =>
        query.groupBy === 'month'
          ? a.key.localeCompare(b.key)
          : b.bookingCount - a.bookingCount || a.label.localeCompare(b.label, 'vi')
      );

    return {
      groupBy: query.groupBy,
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
      total: {
        bookingCount: tongDon,
        itemQuantity: tongSoLuong,
        totalHours: lamTron(tongGio),
      },
    };
  }

  async noShow(query: EquipmentReportQuery): Promise<EquipmentNoShowReportRow[]> {
    const { from, to } = doiKhoangBaoCao(query);

    const rows = await this.prisma.equipmentBooking.findMany({
      where: {
        status: 'NO_SHOW',
        startAt: { gte: from, lt: to },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: BOOKING_SELECT,
      orderBy: { startAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      roomName: r.room.name,
      fullName: r.fullName,
      staffCode: r.staffCode,
      department: r.department,
      reason: r.reason,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      items: dsThietBi(r),
    }));
  }

  /**
   * Thiết bị đang nằm ngoài kho, tại thời điểm gọi.
   *
   * Cố ý KHÔNG nhận khoảng thời gian: cái admin cần thấy nhất là chiếc máy
   * chiếu mượn từ nửa năm trước chưa thấy trả, mà đơn đó nằm ngoài mọi khoảng
   * báo cáo thông thường.
   *
   * Đơn `CHECKED_OUT` (người mượn báo đã trả, admin chưa xác nhận) vẫn tính là
   * đang ngoài kho — chừng nào chưa xác nhận thì chưa ai chắc thiết bị đã về.
   */
  async outstanding(query: OutstandingEquipmentQuery): Promise<OutstandingEquipmentReport> {
    const bayGio = new Date();

    const bookings = await this.prisma.equipmentBooking.findMany({
      where: {
        status: { in: [...TRANG_THAI_CHUA_TRA_XONG] },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: BOOKING_SELECT,
      // Quá hạn lâu nhất lên đầu.
      orderBy: { endAt: 'asc' },
    });

    const theoThietBi = new Map<string, EquipmentOnLoanRow>();

    const rows: OutstandingEquipmentRow[] = bookings.map((b) => {
      const treGio = Math.max(0, (bayGio.getTime() - b.endAt.getTime()) / 3_600_000);
      const quaHan = treGio > 0;

      for (const item of b.items) {
        const dong =
          theoThietBi.get(item.equipment.id) ??
          ({
            equipmentId: item.equipment.id,
            equipmentName: item.equipment.name,
            equipmentCode: item.equipment.code,
            unit: item.equipment.unit,
            roomName: b.room.name,
            totalQuantity: item.equipment.totalQuantity,
            onLoanQuantity: 0,
            overdueQuantity: 0,
          } satisfies EquipmentOnLoanRow);

        dong.onLoanQuantity += item.quantity;
        if (quaHan) dong.overdueQuantity += item.quantity;
        theoThietBi.set(item.equipment.id, dong);
      }

      return {
        bookingId: b.id,
        roomName: b.room.name,
        fullName: b.fullName,
        staffCode: b.staffCode,
        department: b.department,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: b.status,
        overdueHours: lamTron(treGio),
        items: dsThietBi(b),
      };
    });

    const byEquipment = [...theoThietBi.values()].sort(
      (a, b) =>
        b.overdueQuantity - a.overdueQuantity ||
        b.onLoanQuantity - a.onLoanQuantity ||
        a.equipmentName.localeCompare(b.equipmentName, 'vi')
    );

    return { generatedAt: bayGio.toISOString(), bookings: rows, byEquipment };
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  private khoaNhom(
    groupBy: Exclude<EquipmentReportGroupBy, 'equipment'>,
    booking: { roomId: string; department: string | null; startAt: Date; room: { name: string } }
  ): { key: string; label: string } {
    if (groupBy === 'room') {
      return { key: booking.roomId, label: booking.room.name };
    }
    if (groupBy === 'department') {
      const to = booking.department?.trim();
      return to ? { key: to, label: to } : { key: '__khong_ghi__', label: '(không ghi tổ)' };
    }
    // Gom theo tháng phải theo GIỜ VIỆT NAM: đơn lúc 00:30 ngày 01/09 giờ VN là
    // 17:30 ngày 31/08 UTC, gom theo UTC sẽ rơi nhầm sang tháng trước.
    const { year, month } = vnParts(booking.startAt);
    return { key: `${year}-${String(month).padStart(2, '0')}`, label: `Tháng ${month}/${year}` };
  }
}

/**
 * Nhãn một thiết bị trong báo cáo. Kèm mã và tên phòng vì thiết bị thuộc về
 * từng phòng — hai phòng cùng có "Máy chiếu" là chuyện thường.
 */
function nhanThietBi(equipment: { name: string; code: string | null }, roomName: string): string {
  const ten = equipment.code ? `${equipment.name} (${equipment.code})` : equipment.name;
  return `${ten} · ${roomName}`;
}

function dsThietBi(booking: BookingRow): EquipmentBookingItemDto[] {
  return booking.items.map((item) => ({
    equipmentId: item.equipment.id,
    equipmentName: item.equipment.name,
    equipmentCode: item.equipment.code,
    unit: item.equipment.unit,
    quantity: item.quantity,
  }));
}

function lamTron(n: number): number {
  return Number(n.toFixed(2));
}
