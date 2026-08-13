import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import {
  vnParts,
  type DiscrepancyReportRow,
  type NoShowReportRow,
  type ReportGroupBy,
  type RoomReportQuery,
  type UsageReport,
  type UsageReportRow,
} from '@lumibach/types';
import { soSanhBanGiao } from './handovers.service';
import { HandoverFieldsService } from './handover-fields.service';

/** Khoảng thời gian tối đa cho một lần chạy báo cáo. */
const KHOANG_TOI_DA_NGAY = 400;

const BOOKING_SELECT = {
  id: true,
  roomId: true,
  status: true,
  department: true,
  startAt: true,
  endAt: true,
  room: { select: { name: true } },
} as const;

/**
 * Báo cáo sử dụng phòng chức năng.
 *
 * Gom số liệu bằng JavaScript sau khi lấy dữ liệu thô, không dùng SQL gom nhóm.
 * Lý do: quy mô một trường là vài trăm đơn mỗi tháng, chênh lệch tốc độ không
 * đáng kể, đổi lại logic gom theo GIỜ VIỆT NAM (nhóm theo tháng) viết thẳng
 * bằng `vnParts` thay vì phải nhồi phép đổi múi giờ vào câu SQL.
 */
@Injectable()
export class RoomReportsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fields: HandoverFieldsService
  ) {}

  async usage(query: RoomReportQuery): Promise<UsageReport> {
    const { from, to } = this.doiKhoang(query);

    const bookings = await this.prisma.roomBooking.findMany({
      where: {
        startAt: { gte: from, lt: to },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: BOOKING_SELECT,
      orderBy: { startAt: 'asc' },
    });

    const theoNhom = new Map<string, UsageReportRow>();
    let tongDon = 0;
    let tongGio = 0;

    for (const b of bookings) {
      const { key, label } = this.khoaNhom(query.groupBy, b);
      const dong =
        theoNhom.get(key) ??
        ({
          key,
          label,
          bookingCount: 0,
          totalHours: 0,
          completedCount: 0,
          noShowCount: 0,
          cancelledCount: 0,
          rejectedCount: 0,
        } satisfies UsageReportRow);

      const soGio = (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000;
      dong.bookingCount += 1;
      dong.totalHours += soGio;
      if (b.status === 'COMPLETED') dong.completedCount += 1;
      if (b.status === 'NO_SHOW') dong.noShowCount += 1;
      if (b.status === 'CANCELLED') dong.cancelledCount += 1;
      if (b.status === 'REJECTED') dong.rejectedCount += 1;

      theoNhom.set(key, dong);
      tongDon += 1;
      tongGio += soGio;
    }

    const rows = [...theoNhom.values()]
      .map((r) => ({ ...r, totalHours: lamTron(r.totalHours) }))
      // Nhóm theo tháng thì sắp theo thời gian; còn lại sắp theo mức sử dụng
      // giảm dần — thứ admin muốn thấy trước là phòng/tổ dùng nhiều nhất.
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
      total: { bookingCount: tongDon, totalHours: lamTron(tongGio) },
    };
  }

  async noShow(query: RoomReportQuery): Promise<NoShowReportRow[]> {
    const { from, to } = this.doiKhoang(query);

    const rows = await this.prisma.roomBooking.findMany({
      where: {
        status: 'NO_SHOW',
        startAt: { gte: from, lt: to },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: {
        id: true,
        fullName: true,
        staffCode: true,
        department: true,
        reason: true,
        startAt: true,
        endAt: true,
        room: { select: { name: true } },
      },
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
    }));
  }

  /**
   * Các đơn có số liệu bàn giao trả về ÍT HƠN lúc nhận.
   *
   * Cờ `hasDiscrepancy` được đặt lúc trả phòng, nhưng báo cáo tính lại chi tiết
   * thiếu hụt từ chính hai lượt bàn giao — nhờ vậy admin thấy được thiếu cái gì
   * và thiếu bao nhiêu, chứ không chỉ biết "đơn này có vấn đề".
   */
  async discrepancies(query: RoomReportQuery): Promise<DiscrepancyReportRow[]> {
    const { from, to } = this.doiKhoang(query);

    const bookings = await this.prisma.roomBooking.findMany({
      where: {
        hasDiscrepancy: true,
        startAt: { gte: from, lt: to },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        room: { deletedAt: null },
      },
      select: {
        id: true,
        roomId: true,
        fullName: true,
        department: true,
        startAt: true,
        endAt: true,
        adminReviewNote: true,
        room: { select: { name: true } },
        handovers: {
          select: { type: true, fieldValues: true, performedAt: true },
        },
      },
      orderBy: { startAt: 'desc' },
    });

    const ketQua: DiscrepancyReportRow[] = [];

    for (const b of bookings) {
      const nhan = b.handovers.find((h) => h.type === 'CHECKIN');
      const tra = b.handovers.find((h) => h.type === 'CHECKOUT');
      if (!nhan || !tra) continue;

      const danhSachTruong = await this.fields.list({ roomId: b.roomId, includeInactive: true });
      const diff = soSanhBanGiao(
        nhan.fieldValues as Record<string, string | number | boolean | null>,
        tra.fieldValues as Record<string, string | number | boolean | null>,
        danhSachTruong
      );

      const thieu = diff
        .filter((d) => d.shortfall !== null && d.shortfall > 0)
        .map((d) => ({
          key: d.key,
          label: d.label,
          checkinValue: d.checkinValue as number,
          checkoutValue: d.checkoutValue as number,
          shortfall: d.shortfall as number,
        }));

      if (thieu.length === 0) continue;

      ketQua.push({
        bookingId: b.id,
        roomName: b.room.name,
        fullName: b.fullName,
        department: b.department,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        checkoutAt: tra.performedAt.toISOString(),
        adminReviewNote: b.adminReviewNote,
        shortfalls: thieu,
      });
    }

    return ketQua;
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  private doiKhoang(query: RoomReportQuery): { from: Date; to: Date } {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ.');
    }
    // Chặn khoảng quá rộng: báo cáo gom số liệu trong bộ nhớ nên một lần quét
    // nhiều năm sẽ kéo cả bảng lên.
    const soNgay = (to.getTime() - from.getTime()) / 86_400_000;
    if (soNgay > KHOANG_TOI_DA_NGAY) {
      throw new BadRequestException(
        `Khoảng báo cáo tối đa ${KHOANG_TOI_DA_NGAY} ngày. Vui lòng chia nhỏ khoảng thời gian.`
      );
    }

    return { from, to };
  }

  private khoaNhom(
    groupBy: ReportGroupBy,
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
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return { key, label: `Tháng ${month}/${year}` };
  }
}

function lamTron(n: number): number {
  return Number(n.toFixed(2));
}
