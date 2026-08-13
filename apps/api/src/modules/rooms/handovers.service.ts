import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import {
  DEFAULT_ROOM_BOOKING_SETTING,
  type BookingHandoverSummary,
  type HandoverDiffRow,
  type HandoverDto,
  type HandoverFieldDto,
  type HandoverPhotoInput,
  type RoomBookingSettingDto,
  type SubmitHandoverBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { assertTransition } from './booking-state';
import { canCheckInNow, checkInWindowMessage } from './booking-rules';
import { HandoverFieldsService } from './handover-fields.service';

type GiaTriTruong = string | number | boolean | null;
// Bucket RIÊNG, không phải bucket file dùng chung: xem ghi chú ở
// apps/web/src/lib/storage.ts về lý do phải tách.
const HANDOVER_PHOTO_BUCKET = process.env.MINIO_BUCKET_HANDOVERS ?? 'lumibach-handovers';
const HANDOVER_PHOTO_PREFIX = 'handover-photos/';
const PHOTO_CLOCK_SKEW_LIMIT_SECONDS = 5 * 60;

@Injectable()
export class HandoversService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly fields: HandoverFieldsService
  ) {}

  /** Toàn cảnh bàn giao của một đơn: lượt nhận, lượt trả và bảng đối chiếu. */
  async getSummary(user: AuthUser, bookingId: string): Promise<BookingHandoverSummary> {
    const booking = await this.requireReadableBooking(user, bookingId);

    const handovers = await this.prisma.handover.findMany({
      where: { roomBookingId: bookingId },
      include: {
        performedBy: { select: { fullName: true, email: true } },
        photos: {
          select: {
            id: true,
            width: true,
            height: true,
            serverReceivedAt: true,
            flagged: true,
          },
        },
      },
    });

    const checkin = handovers.find((h) => h.type === 'CHECKIN') ?? null;
    const checkout = handovers.find((h) => h.type === 'CHECKOUT') ?? null;
    const danhSachTruong = await this.fields.list({
      roomId: booking.roomId,
      includeInactive: true,
    });

    return {
      bookingId,
      checkin: checkin ? this.toDto(checkin) : null,
      checkout: checkout ? this.toDto(checkout) : null,
      diff:
        checkin && checkout
          ? soSanhBanGiao(
              checkin.fieldValues as Record<string, GiaTriTruong>,
              checkout.fieldValues as Record<string, GiaTriTruong>,
              danhSachTruong
            )
          : [],
      hasDiscrepancy: booking.hasDiscrepancy,
    };
  }

  /** Trường cần điền cho một lượt bàn giao cụ thể. */
  async fieldsForBooking(
    user: AuthUser,
    bookingId: string,
    type: 'CHECKIN' | 'CHECKOUT'
  ): Promise<HandoverFieldDto[]> {
    const booking = await this.requireReadableBooking(user, bookingId);
    return this.fields.list({ roomId: booking.roomId, applies: type });
  }

  async checkIn(user: AuthUser, bookingId: string, body: SubmitHandoverBody): Promise<HandoverDto> {
    const booking = await this.requireOwnBooking(user, bookingId);
    const status = assertTransition(booking.status, 'checkin');

    // Tiêu chí nghiệm thu: không nhận phòng được nếu chưa tick đã đọc nội quy.
    if (!body.ruleAccepted) {
      throw new BadRequestException('Vui lòng xác nhận đã đọc nội quy phòng trước khi nhận phòng.');
    }

    const setting = await this.resolveSetting(booking.roomId);
    if (user.role !== 'ADMIN' && !canCheckInNow(booking, setting, new Date())) {
      throw new BadRequestException(checkInWindowMessage(booking, setting, new Date()));
    }
    this.validatePhotos(user, setting, body.photos);

    const fieldValues = await this.validateFieldValues(booking.roomId, 'CHECKIN', body.fieldValues);
    const photos = this.photoCreates(body.photos);

    const handover = await this.prisma.$transaction(async (tx) => {
      const created = await tx.handover.create({
        data: {
          bookableType: 'ROOM',
          type: 'CHECKIN',
          roomBookingId: bookingId,
          performedById: user.id,
          ruleAccepted: true,
          conditionNote: body.conditionNote,
          fieldValues,
          ...(photos.length > 0 ? { photos: { create: photos } } : {}),
        },
        include: { performedBy: { select: { fullName: true, email: true } }, photos: true },
      });

      await tx.roomBooking.update({ where: { id: bookingId }, data: { status } });
      return created;
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_CHECKIN',
      resource: 'RoomBooking',
      resourceId: bookingId,
      metadata: { handoverId: handover.id, fieldValues },
    });

    return this.toDto(handover);
  }

  async checkOut(
    user: AuthUser,
    bookingId: string,
    body: SubmitHandoverBody
  ): Promise<HandoverDto> {
    const booking = await this.requireOwnBooking(user, bookingId);
    const status = assertTransition(booking.status, 'checkout');

    const checkin = await this.prisma.handover.findFirst({
      where: { roomBookingId: bookingId, type: 'CHECKIN' },
      select: { fieldValues: true },
    });
    // State machine đã chặn (chỉ CHECKED_IN mới trả phòng được), nhưng kiểm lại
    // để nếu dữ liệu bị sửa tay thì cũng không tạo được lượt trả mồ côi.
    if (!checkin) {
      throw new BadRequestException('Chưa có dữ liệu nhận phòng, không thể trả phòng.');
    }

    const setting = await this.resolveSetting(booking.roomId);
    this.validatePhotos(user, setting, body.photos);

    const fieldValues = await this.validateFieldValues(
      booking.roomId,
      'CHECKOUT',
      body.fieldValues
    );
    const photos = this.photoCreates(body.photos);

    const danhSachTruong = await this.fields.list({
      roomId: booking.roomId,
      includeInactive: true,
    });
    const diff = soSanhBanGiao(
      checkin.fieldValues as Record<string, GiaTriTruong>,
      fieldValues,
      danhSachTruong
    );
    // Chỉ số liệu TRẢ VỀ ÍT HƠN mới là bất thường. Trả nhiều hơn lúc nhận thì
    // lạ nhưng không phải mất mát, không đáng bắt admin đi kiểm tra.
    const coLech = diff.some((d) => d.shortfall !== null && d.shortfall > 0);

    const handover = await this.prisma.$transaction(async (tx) => {
      const created = await tx.handover.create({
        data: {
          bookableType: 'ROOM',
          type: 'CHECKOUT',
          roomBookingId: bookingId,
          performedById: user.id,
          ruleAccepted: body.ruleAccepted,
          conditionNote: body.conditionNote,
          fieldValues,
          ...(photos.length > 0 ? { photos: { create: photos } } : {}),
        },
        include: { performedBy: { select: { fullName: true, email: true } }, photos: true },
      });

      await tx.roomBooking.update({
        where: { id: bookingId },
        data: { status, hasDiscrepancy: coLech },
      });
      return created;
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_CHECKOUT',
      resource: 'RoomBooking',
      resourceId: bookingId,
      metadata: {
        handoverId: handover.id,
        hasDiscrepancy: coLech,
        thieuHut: diff.filter((d) => d.shortfall !== null && d.shortfall > 0),
      },
    });

    return this.toDto(handover);
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  /**
   * Kiểm giá trị người dùng gửi lên so với định nghĩa trường: đúng kiểu, đủ
   * trường bắt buộc, giá trị chọn nằm trong danh sách. Trả về bản đã chuẩn hoá,
   * BỎ mọi khoá lạ — không lưu dữ liệu không có định nghĩa.
   */
  private async validateFieldValues(
    roomId: string,
    type: 'CHECKIN' | 'CHECKOUT',
    raw: Record<string, GiaTriTruong>
  ): Promise<Record<string, GiaTriTruong>> {
    const danhSach = await this.fields.list({ roomId, applies: type });
    const ketQua: Record<string, GiaTriTruong> = {};
    const loi: string[] = [];

    for (const field of danhSach) {
      const giaTri = raw[field.key];
      const boTrong = giaTri === undefined || giaTri === null || giaTri === '';

      if (boTrong) {
        if (field.isRequired) loi.push(`Vui lòng điền "${field.label}".`);
        ketQua[field.key] = null;
        continue;
      }

      switch (field.dataType) {
        case 'NUMBER': {
          const so = typeof giaTri === 'number' ? giaTri : Number(giaTri);
          if (!Number.isFinite(so) || so < 0) {
            loi.push(`"${field.label}" phải là số không âm.`);
          } else {
            ketQua[field.key] = so;
          }
          break;
        }
        case 'BOOLEAN': {
          ketQua[field.key] = giaTri === true || giaTri === 'true';
          break;
        }
        case 'SELECT': {
          const chuoi = String(giaTri);
          if (field.options && !field.options.includes(chuoi)) {
            loi.push(`"${field.label}" có giá trị không nằm trong danh sách cho phép.`);
          } else {
            ketQua[field.key] = chuoi;
          }
          break;
        }
        default: {
          const chuoi = String(giaTri).trim();
          if (chuoi.length > 500) {
            loi.push(`"${field.label}" tối đa 500 ký tự.`);
          } else {
            ketQua[field.key] = chuoi;
          }
        }
      }
    }

    if (loi.length > 0) {
      throw new BadRequestException({
        code: 'HANDOVER_FIELD_INVALID',
        message: loi.join(' '),
        details: loi,
      });
    }

    return ketQua;
  }

  private validatePhotos(
    user: AuthUser,
    setting: RoomBookingSettingDto,
    photos: readonly HandoverPhotoInput[]
  ): void {
    if (photos.length < setting.minPhotosPerHandover) {
      throw new BadRequestException(
        `Vui lòng chụp/tải lên ít nhất ${setting.minPhotosPerHandover} ảnh bàn giao.`
      );
    }
    if (photos.length > setting.maxPhotosPerHandover) {
      throw new BadRequestException(
        `Mỗi lượt bàn giao tối đa ${setting.maxPhotosPerHandover} ảnh.`
      );
    }

    for (const photo of photos) {
      if (photo.bucket !== HANDOVER_PHOTO_BUCKET) {
        throw new BadRequestException('Ảnh bàn giao không thuộc storage của hệ thống.');
      }
      if (!photo.objectName.startsWith(`${HANDOVER_PHOTO_PREFIX}${user.id}/`)) {
        throw new BadRequestException('Ảnh bàn giao không thuộc phiên đăng nhập hiện tại.');
      }
      if (!photo.mime.startsWith('image/')) {
        throw new BadRequestException('File bàn giao phải là ảnh.');
      }
    }
  }

  private photoCreates(photos: readonly HandoverPhotoInput[]) {
    const now = new Date();

    return photos.map((photo) => {
      const capturedAtClient = photo.capturedAtClient ? new Date(photo.capturedAtClient) : null;
      const clockSkewSeconds = capturedAtClient
        ? Math.round((now.getTime() - capturedAtClient.getTime()) / 1000)
        : null;

      return {
        bucket: photo.bucket,
        objectName: photo.objectName,
        mime: photo.mime,
        size: photo.size,
        sha256: photo.sha256.toLowerCase(),
        width: photo.width,
        height: photo.height,
        capturedAtClient,
        clockSkewSeconds,
        flagged:
          clockSkewSeconds !== null && Math.abs(clockSkewSeconds) > PHOTO_CLOCK_SKEW_LIMIT_SECONDS,
      };
    });
  }

  private async requireOwnBooking(user: AuthUser, id: string) {
    const booking = await this.prisma.roomBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn phòng.');
    if (booking.userId !== user.id) {
      throw new ForbiddenException('Chỉ người mượn mới nhận và trả phòng được.');
    }
    return booking;
  }

  /** Chủ đơn và admin đọc được dữ liệu bàn giao; người khác thì không. */
  private async requireReadableBooking(user: AuthUser, id: string) {
    const booking = await this.prisma.roomBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn phòng.');
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không xem được dữ liệu bàn giao của đơn này.');
    }
    return booking;
  }

  private toDto(handover: {
    id: string;
    type: 'CHECKIN' | 'CHECKOUT';
    performedAt: Date;
    ruleAccepted: boolean;
    conditionNote: string;
    fieldValues: unknown;
    performedBy: { fullName: string | null; email: string } | null;
    photos: {
      id: string;
      width: number;
      height: number;
      serverReceivedAt: Date;
      flagged: boolean;
    }[];
  }): HandoverDto {
    return {
      id: handover.id,
      type: handover.type,
      performedByName: handover.performedBy?.fullName ?? handover.performedBy?.email ?? null,
      performedAt: handover.performedAt.toISOString(),
      ruleAccepted: handover.ruleAccepted,
      conditionNote: handover.conditionNote,
      fieldValues: (handover.fieldValues ?? {}) as Record<string, GiaTriTruong>,
      photos: handover.photos.map((p) => ({
        id: p.id,
        url: `/api/v1/handover-photos/${p.id}/file`,
        width: p.width,
        height: p.height,
        serverReceivedAt: p.serverReceivedAt.toISOString(),
        flagged: p.flagged,
      })),
    };
  }

  private async resolveSetting(roomId: string): Promise<RoomBookingSettingDto> {
    const [cuaPhong, macDinh] = await Promise.all([
      this.prisma.roomBookingSetting.findUnique({ where: { roomId } }),
      this.prisma.roomBookingSetting.findFirst({ where: { roomId: null } }),
    ]);
    const nguon = cuaPhong ?? macDinh;
    if (!nguon) return { ...DEFAULT_ROOM_BOOKING_SETTING, isDefault: true };

    return {
      openTime: nguon.openTime,
      closeTime: nguon.closeTime,
      slotStepMinutes: nguon.slotStepMinutes,
      minDurationMinutes: nguon.minDurationMinutes,
      maxDurationMinutes: nguon.maxDurationMinutes,
      maxAdvanceDays: nguon.maxAdvanceDays,
      allowWeekend: nguon.allowWeekend,
      checkinWindowMinutes: nguon.checkinWindowMinutes,
      minPhotosPerHandover: nguon.minPhotosPerHandover,
      maxPhotosPerHandover: nguon.maxPhotosPerHandover,
      photoRetentionMonths: nguon.photoRetentionMonths,
      isDefault: cuaPhong === null,
    };
  }
}

/**
 * Đối chiếu số liệu lúc nhận và lúc trả.
 *
 * Tách thành hàm thuần để test được toàn bộ tổ hợp mà không cần CSDL. Chỉ trường
 * dạng số mới tính được `shortfall`; các kiểu khác chỉ đánh dấu có đổi hay không.
 */
export function soSanhBanGiao(
  luocNhan: Record<string, GiaTriTruong>,
  luocTra: Record<string, GiaTriTruong>,
  fields: readonly HandoverFieldDto[]
): HandoverDiffRow[] {
  const lienQuan = fields.filter((f) => f.appliesTo === 'BOTH');

  return lienQuan.map((field) => {
    const truoc = luocNhan[field.key] ?? null;
    const sau = luocTra[field.key] ?? null;

    const laSo =
      field.dataType === 'NUMBER' && typeof truoc === 'number' && typeof sau === 'number';

    return {
      key: field.key,
      label: field.label,
      checkinValue: truoc,
      checkoutValue: sau,
      changed: truoc !== sau,
      shortfall: laSo ? (truoc as number) - (sau as number) : null,
    };
  });
}
