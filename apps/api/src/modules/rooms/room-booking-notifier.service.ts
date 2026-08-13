import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { vnRangeLabel } from '@lumibach/types';
import { EmailService } from '../../common/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Gửi thông báo cho module Phòng chức năng: in-app (kèm đẩy qua WebSocket) và
 * email, gộp về một chỗ để các service nghiệp vụ không phải lặp lại.
 *
 * Nguyên tắc: MỌI lỗi ở đây đều bị nuốt và ghi log. Thông báo hỏng không được
 * phép làm hỏng một thao tác duyệt/từ chối đã thành công ở phía CSDL — cùng
 * tinh thần với AuditService.
 */
@Injectable()
export class RoomBookingNotifier {
  private readonly logger = new Logger(RoomBookingNotifier.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  /** Đơn mới nộp → báo cho tất cả admin để họ vào hàng chờ duyệt. */
  async donMoiNop(booking: BookingInfo): Promise<void> {
    await this.guard('donMoiNop', async () => {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
        select: { id: true, email: true, fullName: true },
      });

      const khungGio = vnRangeLabel(booking.startAt, booking.endAt);
      const title = 'Có đơn mượn phòng mới chờ duyệt';
      const body = `${booking.fullName} đăng ký ${booking.roomName}, ${khungGio}.`;

      await Promise.all(
        admins.map(async (admin) => {
          await this.notifications.create(admin.id, {
            type: 'ROOM_BOOKING_SUBMITTED',
            title,
            body,
            link: '/admin/rooms/bookings',
          });

          if (await this.emailBat(admin.id)) {
            await this.email.sendRoomBookingEmail({
              to: admin.email,
              subject: `[LumiBach] Đơn mượn ${booking.roomName} chờ duyệt`,
              heading: 'Đơn mượn phòng mới',
              intro: 'Có một đơn đăng ký mượn phòng đang chờ bạn duyệt.',
              lines: this.dongThongTin(booking),
              ctaLabel: 'Vào hàng chờ duyệt',
              ctaPath: '/admin/rooms/bookings',
            });
          }
        })
      );
    });
  }

  /**
   * Đơn được duyệt → báo cho người mượn, kèm nội quy đúng phiên bản đã chốt.
   * Nội dung thông báo theo đúng yêu cầu nghiệp vụ: nhắc đi gặp admin nhận chìa khoá.
   */
  async donDuocDuyet(booking: BookingInfo, ruleContent: string | null): Promise<void> {
    await this.guard('donDuocDuyet', async () => {
      const nguoiMuon = await this.layNguoiDung(booking.userId);
      if (!nguoiMuon) return;

      const body = 'Đơn đã được duyệt. Vui lòng gặp Quản trị viên để nhận chìa khoá.';

      // Trỏ thẳng tới bước nhận phòng (nơi có checkbox "đã đọc nội quy" bắt buộc)
      // thay vì danh sách đơn chung chung — GV từng báo không tìm thấy chỗ xác
      // nhận nội quy vì phải tự dò qua danh sách → chi tiết đơn → nút "Nhận phòng".
      const checkinPath = `/rooms/bookings/${booking.id}/checkin`;

      await this.notifications.create(nguoiMuon.id, {
        type: 'ROOM_BOOKING_APPROVED',
        title: `Đơn mượn ${booking.roomName} đã được duyệt`,
        body,
        link: checkinPath,
      });

      if (await this.emailBat(nguoiMuon.id)) {
        await this.email.sendRoomBookingEmail({
          to: nguoiMuon.email,
          subject: `[LumiBach] Đơn mượn ${booking.roomName} đã được duyệt`,
          heading: 'Đơn mượn phòng đã được duyệt',
          intro: body,
          lines: this.dongThongTin(booking),
          ctaLabel: 'Xác nhận nội quy & nhận phòng',
          ctaPath: checkinPath,
          extraHtml: ruleContent
            ? `<div style="margin-top:24px;padding:16px;border:1px solid #ddd;border-radius:8px;background:#fafafa">
                 <h3 style="margin:0 0 8px;color:#050E3C;font-size:15px">Nội quy phòng</h3>
                 <div style="color:#333;font-size:14px;line-height:1.6">${ruleContent}</div>
               </div>`
            : undefined,
        });
      }
    });
  }

  /** Đơn bị từ chối → báo cho người mượn kèm lý do. */
  async donBiTuChoi(booking: BookingInfo, lyDo: string): Promise<void> {
    await this.guard('donBiTuChoi', async () => {
      const nguoiMuon = await this.layNguoiDung(booking.userId);
      if (!nguoiMuon) return;

      await this.notifications.create(nguoiMuon.id, {
        type: 'ROOM_BOOKING_REJECTED',
        title: `Đơn mượn ${booking.roomName} bị từ chối`,
        body: `Lý do: ${lyDo}`,
        link: '/rooms/bookings',
      });

      if (await this.emailBat(nguoiMuon.id)) {
        await this.email.sendRoomBookingEmail({
          to: nguoiMuon.email,
          subject: `[LumiBach] Đơn mượn ${booking.roomName} bị từ chối`,
          heading: 'Đơn mượn phòng bị từ chối',
          intro: 'Rất tiếc, đơn đăng ký mượn phòng của bạn không được duyệt.',
          lines: [...this.dongThongTin(booking), { label: 'Lý do từ chối', value: lyDo }],
          ctaLabel: 'Xem đơn của tôi',
          ctaPath: '/rooms/bookings',
        });
      }
    });
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  private dongThongTin(booking: BookingInfo) {
    return [
      { label: 'Phòng', value: booking.roomName },
      { label: 'Thời gian', value: vnRangeLabel(booking.startAt, booking.endAt) },
      { label: 'Người mượn', value: booking.fullName },
      ...(booking.department ? [{ label: 'Tổ chuyên môn', value: booking.department }] : []),
      { label: 'Lý do', value: booking.reason },
    ];
  }

  private async layNguoiDung(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
  }

  /** Tôn trọng cài đặt nhận email của người dùng. */
  private async emailBat(userId: string): Promise<boolean> {
    const prefs = await this.notifications.getPrefs(userId);
    return prefs.emailEnabled;
  }

  private async guard(ten: string, thaoTac: () => Promise<void>): Promise<void> {
    try {
      await thaoTac();
    } catch (err) {
      this.logger.error(`Gửi thông báo "${ten}" thất bại: ${(err as Error).message}`);
    }
  }
}

export type BookingInfo = {
  id: string;
  userId: string;
  roomName: string;
  fullName: string;
  department: string | null;
  reason: string;
  startAt: Date;
  endAt: Date;
};
