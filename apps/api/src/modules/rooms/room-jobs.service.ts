import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { DEFAULT_ROOM_BOOKING_SETTING, vnRangeLabel } from '@lumibach/types';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

export type NoShowResult = {
  roomBookings: number;
  equipmentBookings: number;
};

export type PurgePhotosResult = {
  /** Số bản ghi ảnh đã xoá khỏi CSDL. */
  purged: number;
  /** Số file đã gỡ khỏi storage. */
  filesRemoved: number;
};

/**
 * Các việc chạy theo lịch của module Phòng chức năng.
 *
 * Gọi qua endpoint có `x-cron-secret`, theo đúng cách `purge-expired` của module
 * khoá học đang làm — máy chủ không có Internet nên cron là crontab của Linux
 * gọi curl vào localhost, không phải dịch vụ cron ngoài.
 */
@Injectable()
export class RoomJobsService {
  private readonly logger = new Logger(RoomJobsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService
  ) {}

  /**
   * Đánh dấu các đơn đã duyệt nhưng không ai đến nhận.
   *
   * Mốc chọn là ĐÃ QUA GIỜ KẾT THÚC, không phải quá giờ bắt đầu: người mượn
   * được phép nhận phòng muộn cho tới hết khung giờ (xem `canCheckInNow`), nên
   * đánh dấu sớm hơn sẽ mâu thuẫn với chính luật cho nhận muộn — giáo viên đến
   * trễ 20 phút sẽ thấy đơn của mình đã bị huỷ.
   */
  async markNoShow(now = new Date()): Promise<NoShowResult> {
    const donPhong = await this.prisma.roomBooking.findMany({
      where: { status: 'APPROVED', endAt: { lt: now } },
      select: {
        id: true,
        userId: true,
        startAt: true,
        endAt: true,
        room: { select: { name: true } },
      },
    });

    for (const don of donPhong) {
      await this.prisma.roomBooking.update({
        where: { id: don.id },
        data: { status: 'NO_SHOW' },
      });

      this.audit.log({
        action: 'ROOM_BOOKING_NO_SHOW',
        resource: 'RoomBooking',
        resourceId: don.id,
        metadata: { endAt: don.endAt.toISOString(), boiCron: true },
      });

      await this.baoNoShow(don.userId, don.room.name, don.startAt, don.endAt);
    }

    const donThietBi = await this.prisma.equipmentBooking.findMany({
      where: { status: 'APPROVED', endAt: { lt: now } },
      select: {
        id: true,
        userId: true,
        startAt: true,
        endAt: true,
        room: { select: { name: true } },
      },
    });

    for (const don of donThietBi) {
      await this.prisma.equipmentBooking.update({
        where: { id: don.id },
        data: { status: 'NO_SHOW' },
      });

      this.audit.log({
        action: 'EQUIPMENT_BOOKING_NO_SHOW',
        resource: 'EquipmentBooking',
        resourceId: don.id,
        metadata: { endAt: don.endAt.toISOString(), boiCron: true },
      });

      await this.baoNoShow(don.userId, don.room.name, don.startAt, don.endAt);
    }

    if (donPhong.length + donThietBi.length > 0) {
      this.logger.log(
        `Đánh dấu không đến nhận: ${donPhong.length} đơn phòng, ${donThietBi.length} đơn thiết bị`
      );
    }

    return { roomBookings: donPhong.length, equipmentBookings: donThietBi.length };
  }

  /**
   * Dọn ảnh minh chứng quá hạn lưu giữ.
   *
   * Chỉ xoá ẢNH, giữ nguyên bản ghi bàn giao: số liệu kiểm đếm và mô tả tình
   * trạng vẫn là dữ liệu cần tra cứu về sau, chỉ có file ảnh mới chiếm dung
   * lượng đáng kể.
   *
   * Thời hạn lấy theo cấu hình của TỪNG PHÒNG, phòng chưa cấu hình riêng thì
   * theo bản mặc định toàn hệ thống.
   */
  async purgeOldPhotos(now = new Date()): Promise<PurgePhotosResult> {
    const thoiHanTheoPhong = await this.thoiHanLuuGiuTheoPhong();
    const macDinh = await this.thoiHanMacDinh();

    const anh = await this.prisma.handoverPhoto.findMany({
      select: {
        id: true,
        bucket: true,
        objectName: true,
        createdAt: true,
        handover: {
          select: {
            roomBooking: { select: { roomId: true } },
            equipmentBooking: { select: { roomId: true } },
          },
        },
      },
    });

    const canXoa = anh.filter((a) => {
      const roomId = a.handover.roomBooking?.roomId ?? a.handover.equipmentBooking?.roomId;
      const soThang = (roomId ? thoiHanTheoPhong.get(roomId) : undefined) ?? macDinh;
      // 0 tháng = giữ vĩnh viễn, tránh việc đặt nhầm thành 0 rồi xoá sạch.
      if (soThang <= 0) return false;
      return a.createdAt.getTime() < now.getTime() - soThang * 30 * 86_400_000;
    });

    if (canXoa.length === 0) return { purged: 0, filesRemoved: 0 };

    // Xoá bản ghi TRƯỚC rồi mới gỡ file — đúng thứ tự StorageService yêu cầu.
    // File mồ côi thì vô hại, còn bản ghi trỏ vào file đã mất thì gây lỗi 404
    // khi admin mở xem.
    await this.prisma.handoverPhoto.deleteMany({
      where: { id: { in: canXoa.map((a) => a.id) } },
    });

    const filesRemoved = await this.storage.removeByUrls(
      canXoa.map((a) => `/storage/${a.bucket}/${a.objectName}`)
    );

    this.audit.log({
      action: 'HANDOVER_PHOTO_PURGE',
      resource: 'HandoverPhoto',
      metadata: { purged: canXoa.length, filesRemoved },
    });
    this.logger.log(`Dọn ảnh bàn giao quá hạn: ${canXoa.length} bản ghi, ${filesRemoved} file`);

    return { purged: canXoa.length, filesRemoved };
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  private async baoNoShow(userId: string, roomName: string, startAt: Date, endAt: Date) {
    try {
      await this.notifications.create(userId, {
        type: 'ROOM_BOOKING_NO_SHOW',
        title: `Đơn mượn ${roomName} bị đánh dấu không đến nhận`,
        body: `Khung giờ ${vnRangeLabel(startAt, endAt)} đã qua mà chưa nhận phòng. Vui lòng đăng ký lại nếu vẫn cần.`,
        link: '/rooms/bookings',
      });
    } catch (err) {
      // Thông báo hỏng không được làm dừng cả lượt cron.
      this.logger.error(`Không gửi được thông báo không đến nhận: ${(err as Error).message}`);
    }
  }

  private async thoiHanLuuGiuTheoPhong(): Promise<Map<string, number>> {
    const rows = await this.prisma.roomBookingSetting.findMany({
      where: { roomId: { not: null } },
      select: { roomId: true, photoRetentionMonths: true },
    });
    return new Map(rows.map((r) => [r.roomId as string, r.photoRetentionMonths]));
  }

  private async thoiHanMacDinh(): Promise<number> {
    const row = await this.prisma.roomBookingSetting.findFirst({
      where: { roomId: null },
      select: { photoRetentionMonths: true },
    });
    return row?.photoRetentionMonths ?? DEFAULT_ROOM_BOOKING_SETTING.photoRetentionMonths;
  }
}
