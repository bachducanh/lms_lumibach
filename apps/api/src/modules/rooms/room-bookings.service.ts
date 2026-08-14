import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@lumibach/db';
import {
  BLOCKING_BOOKING_STATUSES,
  DEFAULT_ROOM_BOOKING_SETTING,
  vnRangeLabel,
  type BulkApproveResult,
  type CreateRoomBookingBody,
  type PendingBookingItem,
  type PendingBookingsQuery,
  type RejectRoomBookingBody,
  type RoomBookingDetail,
  type RoomBookingListItem,
  type RoomBookingSettingDto,
  type RoomBookingsQuery,
  type RoomBookingStatusValue,
  type UpdateRoomBookingBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { assertBookingWindow } from './booking-rules';
import { assertTransition, availableActionsFor } from './booking-state';
import { RoomBookingNotifier, type BookingInfo } from './room-booking-notifier.service';

/** Mã lỗi Postgres khi vi phạm ràng buộc EXCLUDE (chống trùng lịch). */
const PG_EXCLUSION_VIOLATION = '23P01';

const LIST_INCLUDE = {
  room: { select: { id: true, name: true, code: true } },
} as const;

type BookingWithRoom = Prisma.RoomBookingGetPayload<{ include: typeof LIST_INCLUDE }>;

@Injectable()
export class RoomBookingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly notifier: RoomBookingNotifier
  ) {}

  // ── Đọc ──────────────────────────────────────────────────────

  /**
   * Danh sách đơn trong một khoảng thời gian — nguồn dữ liệu cho lịch tuần.
   *
   * Điều kiện giao nhau dùng nửa mở `[from, to)`: lấy mọi đơn có `startAt < to`
   * và `endAt > from`. Viết đúng chiều này thì đơn bắt đầu trước khoảng nhìn
   * nhưng còn kéo dài sang trong khoảng vẫn được lấy.
   */
  async list(user: AuthUser, query: RoomBookingsQuery): Promise<RoomBookingListItem[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() <= from.getTime()) {
      throw new ConflictException('Khoảng thời gian không hợp lệ.');
    }

    const bookings = await this.prisma.roomBooking.findMany({
      where: {
        startAt: { lt: to },
        endAt: { gt: from },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        ...(query.department ? { department: query.department } : {}),
        ...(query.mine ? { userId: user.id } : {}),
        ...(query.status?.length
          ? { status: { in: query.status as RoomBookingStatusValue[] } }
          : {}),
        room: { deletedAt: null },
      },
      include: LIST_INCLUDE,
      orderBy: { startAt: 'asc' },
    });

    return bookings.map((b) => this.toListItem(b, user));
  }

  async getById(user: AuthUser, id: string): Promise<RoomBookingDetail> {
    const booking = await this.prisma.roomBooking.findUnique({
      where: { id },
      include: {
        ...LIST_INCLUDE,
        approvedBy: { select: { fullName: true, email: true } },
      },
    });

    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn phòng.');

    return {
      ...this.toListItem(booking, user),
      ruleContent: await this.layNoiQuyHienHanh(booking.roomId),
      approvedByName: booking.approvedBy?.fullName ?? booking.approvedBy?.email ?? null,
      approvedAt: booking.approvedAt?.toISOString() ?? null,
      rejectReason: booking.rejectReason,
      keyReturnedAt: booking.keyReturnedAt?.toISOString() ?? null,
      hasDiscrepancy: booking.hasDiscrepancy,
      createdAt: booking.createdAt.toISOString(),
      // Tính theo quan hệ với ĐƠN NÀY, không chỉ theo vai trò: admin không huỷ
      // hay sửa hộ đơn của người khác được, nên không được hiện nút đó.
      availableActions: [
        ...availableActionsFor(booking.status, {
          isOwner: booking.userId === user.id,
          isAdmin: user.role === 'ADMIN',
        }),
      ],
    };
  }

  /**
   * Hàng chờ duyệt của admin, kèm cảnh báo xung đột.
   *
   * Xung đột về nguyên tắc không xảy ra được vì ràng buộc EXCLUDE đã chặn hai
   * đơn giữ chỗ trùng giờ. Vẫn tính ở đây để bắt dữ liệu cũ hoặc trường hợp ai
   * đó sửa thẳng vào CSDL — admin cần thấy trước khi bấm duyệt hàng loạt.
   */
  async listPending(query: PendingBookingsQuery): Promise<PendingBookingItem[]> {
    const pending = await this.prisma.roomBooking.findMany({
      where: {
        status: 'PENDING',
        room: { deletedAt: null },
        ...(query.roomId ? { roomId: query.roomId } : {}),
        ...(query.department ? { department: query.department } : {}),
      },
      include: LIST_INCLUDE,
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    });

    const adminUser = { id: '', role: 'ADMIN' } as AuthUser;

    return pending.map((booking) => ({
      ...this.toListItem(booking, adminUser),
      createdAt: booking.createdAt.toISOString(),
      conflictsWith: timDonXungDot(booking, pending).map((khac) => ({
        id: khac.id,
        fullName: khac.fullName,
        startAt: khac.startAt.toISOString(),
        endAt: khac.endAt.toISOString(),
      })),
    }));
  }

  async approve(user: AuthUser, id: string): Promise<RoomBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'approve');

    // Nội quy gửi kèm thư báo duyệt là bản hiện hành lúc này. Không chốt lại
    // nữa — mỗi phòng chỉ có một bản, admin sửa thì đơn cũ cũng theo bản mới.
    const noiQuy = await this.prisma.roomRule.findUnique({
      where: { roomId: booking.roomId },
      select: { content: true },
    });

    await this.prisma.roomBooking.update({
      where: { id },
      data: {
        status,
        approvedById: user.id,
        approvedAt: new Date(),
        rejectReason: null,
      },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_APPROVE',
      resource: 'RoomBooking',
      resourceId: id,
      changes: { truoc: booking.status, sau: status },
    });

    await this.notifier.donDuocDuyet(this.bookingInfo(booking), noiQuy?.content ?? null);

    return this.getById(user, id);
  }

  async reject(
    user: AuthUser,
    id: string,
    body: RejectRoomBookingBody
  ): Promise<RoomBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'reject');

    await this.prisma.roomBooking.update({
      where: { id },
      data: { status, rejectReason: body.reason, approvedById: user.id, approvedAt: new Date() },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_REJECT',
      resource: 'RoomBooking',
      resourceId: id,
      changes: { truoc: booking.status, sau: status },
      metadata: { reason: body.reason },
    });

    await this.notifier.donBiTuChoi(this.bookingInfo(booking), body.reason);

    return this.getById(user, id);
  }

  /**
   * Duyệt nhiều đơn một lượt. Cố ý KHÔNG gói trong một transaction: một đơn
   * hỏng thì các đơn còn lại vẫn phải được duyệt, và admin cần biết chính xác
   * đơn nào trượt vì lý do gì.
   */
  async bulkApprove(user: AuthUser, ids: string[]): Promise<BulkApproveResult> {
    const ketQua: BulkApproveResult = { approved: [], failed: [] };

    for (const id of ids) {
      try {
        await this.approve(user, id);
        ketQua.approved.push(id);
      } catch (err) {
        ketQua.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }
    }

    return ketQua;
  }

  async confirmKeyReturn(user: AuthUser, id: string): Promise<RoomBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'complete');

    await this.prisma.roomBooking.update({
      where: { id },
      data: { status, keyReturnedAt: new Date(), keyReturnedById: user.id },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_KEY_RETURNED',
      resource: 'RoomBooking',
      resourceId: id,
      changes: { truoc: booking.status, sau: status },
    });

    return this.getById(user, id);
  }

  // ── Ghi ──────────────────────────────────────────────────────

  async create(user: AuthUser, body: CreateRoomBookingBody): Promise<RoomBookingDetail> {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);

    const room = await this.requireBookableRoom(body.roomId);
    const setting = await this.resolveSetting(room.id);

    assertBookingWindow(
      { startAt, endAt },
      { setting, now: new Date(), isAdmin: user.role === 'ADMIN' }
    );

    const created = await this.runGuardingOverlap(
      () =>
        this.prisma.roomBooking.create({
          data: {
            roomId: room.id,
            userId: user.id,
            fullName: body.fullName,
            staffCode: body.staffCode ?? null,
            department: body.department ?? null,
            reason: body.reason,
            startAt,
            endAt,
            status: 'PENDING',
          },
          include: LIST_INCLUDE,
        }),
      { roomName: room.name, startAt, endAt }
    );

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_CREATE',
      resource: 'RoomBooking',
      resourceId: created.id,
      metadata: { roomId: room.id, startAt: body.startAt, endAt: body.endAt },
    });

    await this.notifier.donMoiNop(this.bookingInfo(created));

    return this.getById(user, created.id);
  }

  /**
   * Sửa đơn. Chỉ chủ đơn được sửa.
   *
   * Đổi giờ hoặc đổi phòng thì đơn quay về CHỜ DUYỆT (state machine lo phần
   * kiểm tra) — admin là người giao chìa khoá nên không được để lịch thay đổi
   * sau lưng họ. Sửa mỗi lý do hay thông tin cá nhân thì giữ nguyên trạng thái.
   */
  async update(
    user: AuthUser,
    id: string,
    body: UpdateRoomBookingBody
  ): Promise<RoomBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);

    const startAt = body.startAt ? new Date(body.startAt) : booking.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : booking.endAt;
    const roomId = body.roomId ?? booking.roomId;

    const doiLich =
      startAt.getTime() !== booking.startAt.getTime() ||
      endAt.getTime() !== booking.endAt.getTime() ||
      roomId !== booking.roomId;

    let status = booking.status;

    if (doiLich) {
      status = assertTransition(booking.status, 'reschedule');

      const room = await this.requireBookableRoom(roomId);
      const setting = await this.resolveSetting(room.id);
      assertBookingWindow(
        { startAt, endAt },
        { setting, now: new Date(), isAdmin: user.role === 'ADMIN' }
      );
    } else if (booking.status !== 'PENDING' && booking.status !== 'APPROVED') {
      // Đơn đã nhận phòng hoặc đã kết thúc thì không sửa được nữa, kể cả lý do.
      throw new ConflictException('Đơn đã bắt đầu hoặc đã kết thúc, không sửa được nữa.');
    }

    const room = await this.prisma.functionRoom.findUniqueOrThrow({
      where: { id: roomId },
      select: { name: true },
    });

    const updated = await this.runGuardingOverlap(
      () =>
        this.prisma.roomBooking.update({
          where: { id },
          data: {
            roomId,
            startAt,
            endAt,
            status,
            ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
            ...(body.staffCode !== undefined ? { staffCode: body.staffCode } : {}),
            ...(body.department !== undefined ? { department: body.department } : {}),
            ...(body.reason !== undefined ? { reason: body.reason } : {}),
            // Đơn quay về hàng chờ thì xoá dấu vết duyệt cũ, tránh hiển thị
            // "đã duyệt bởi X" trên một đơn đang chờ duyệt lại.
            ...(doiLich && booking.status === 'APPROVED'
              ? { approvedById: null, approvedAt: null }
              : {}),
          },
          include: LIST_INCLUDE,
        }),
      { roomName: room.name, startAt, endAt }
    );

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_UPDATE',
      resource: 'RoomBooking',
      resourceId: id,
      changes: {
        truoc: {
          roomId: booking.roomId,
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          status: booking.status,
        },
        sau: {
          roomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          status: updated.status,
        },
      },
    });

    return this.getById(user, id);
  }

  async cancel(user: AuthUser, id: string): Promise<RoomBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);
    const status = assertTransition(booking.status, 'cancel');

    await this.prisma.roomBooking.update({ where: { id }, data: { status } });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_CANCEL',
      resource: 'RoomBooking',
      resourceId: id,
      changes: { truoc: booking.status, sau: status },
    });

    return this.getById(user, id);
  }

  // ── Trợ giúp nội bộ ──────────────────────────────────────────

  /**
   * Bọc thao tác ghi để đổi lỗi kỹ thuật 23P01 của Postgres thành thông báo
   * tiếng Việt. Đây là chỗ duy nhất phát hiện được va chạm khi hai người đặt
   * cùng slot ở đúng cùng một thời điểm — kiểm tra ở tầng service phía trên
   * luôn có khe hở giữa lúc đọc và lúc ghi.
   */
  private async runGuardingOverlap<T>(
    thaoTac: () => Promise<T>,
    ctx: { roomName: string; startAt: Date; endAt: Date }
  ): Promise<T> {
    try {
      return await thaoTac();
    } catch (err) {
      if (laLoiTrungLich(err)) {
        throw new ConflictException(
          `Khung giờ ${vnRangeLabel(ctx.startAt, ctx.endAt)} ở ${ctx.roomName} vừa có người đặt trước. Vui lòng chọn khung giờ khác.`
        );
      }
      throw err;
    }
  }

  private async requireBookableRoom(roomId: string) {
    const room = await this.prisma.functionRoom.findFirst({
      where: { id: roomId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    if (!room) throw new NotFoundException('Phòng không tồn tại hoặc đang ngừng sử dụng.');
    return room;
  }

  /** Đơn kèm tên phòng — dùng cho các thao tác của admin. */
  private async requireBooking(id: string) {
    const booking = await this.prisma.roomBooking.findUnique({
      where: { id },
      include: LIST_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn phòng.');
    return booking;
  }

  private bookingInfo(booking: BookingWithRoom): BookingInfo {
    return {
      id: booking.id,
      userId: booking.userId,
      roomName: booking.room.name,
      fullName: booking.fullName,
      department: booking.department,
      reason: booking.reason,
      startAt: booking.startAt,
      endAt: booking.endAt,
    };
  }

  /**
   * Nội quy hiện hành của phòng, null nếu phòng chưa soạn nội quy.
   *
   * Trả bản MỚI NHẤT chứ không phải bản lúc duyệt — nội quy nay mỗi phòng một
   * bản, sửa là ghi đè. Đơn duyệt từ trước vì thế cũng hiện theo bản mới.
   */
  private async layNoiQuyHienHanh(roomId: string): Promise<string | null> {
    const rule = await this.prisma.roomRule.findUnique({
      where: { roomId },
      select: { content: true },
    });
    return rule?.content ?? null;
  }

  private async requireOwnBooking(user: AuthUser, id: string) {
    const booking = await this.prisma.roomBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn phòng.');

    // Cố ý KHÔNG cho admin sửa/huỷ hộ: admin có đường riêng là duyệt/từ chối.
    // Sửa hộ đơn của người khác sẽ làm lệch dữ liệu bàn giao về sau.
    if (booking.userId !== user.id) {
      throw new ForbiddenException('Bạn chỉ thao tác được trên đơn của chính mình.');
    }
    return booking;
  }

  private toListItem(booking: BookingWithRoom, user: AuthUser): RoomBookingListItem {
    return {
      id: booking.id,
      roomId: booking.roomId,
      roomName: booking.room.name,
      roomCode: booking.room.code,
      userId: booking.userId,
      fullName: booking.fullName,
      staffCode: booking.staffCode,
      department: booking.department,
      reason: booking.reason,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      isMine: booking.userId === user.id,
    };
  }

  /** Giống RoomsService.resolveSetting nhưng nhận roomId — xem ghi chú ở đó. */
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

  /** Số đơn còn giữ chỗ — dùng cho báo cáo và chặn xoá phòng. */
  async countBlocking(roomId: string): Promise<number> {
    return this.prisma.roomBooking.count({
      where: { roomId, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
    });
  }
}

/** Khoảng thời gian tối thiểu cần để so xung đột. */
export type KhoangDon = {
  id: string;
  roomId: string;
  startAt: Date;
  endAt: Date;
};

/**
 * Các đơn khác cùng phòng và GIAO NHAU về thời gian với `don`.
 *
 * Tách thành hàm thuần để test được mà không phải dựng dữ liệu trùng giờ trong
 * CSDL — điều đó bất khả thi khi ràng buộc EXCLUDE còn hiệu lực, và cách duy
 * nhất để làm được là tạm gỡ ràng buộc, tức là phá đúng thứ đang bảo vệ mình.
 *
 * Dùng nửa mở `[start, end)` cho khớp ràng buộc CSDL: hai đơn chạm mép nhau
 * (10:00 kết thúc, 10:00 bắt đầu) KHÔNG tính là xung đột.
 */
export function timDonXungDot<T extends KhoangDon>(don: T, tatCa: readonly T[]): T[] {
  return tatCa.filter(
    (khac) =>
      khac.id !== don.id &&
      khac.roomId === don.roomId &&
      khac.startAt < don.endAt &&
      khac.endAt > don.startAt
  );
}

/**
 * Prisma bọc lỗi Postgres theo hai cách khác nhau tuỳ đường đi: lỗi có mã đã
 * biết thì thành PrismaClientKnownRequestError, còn ràng buộc EXCLUDE thì rơi
 * xuống lỗi thô của connector. Nhận diện cả hai để không lọt trường hợp nào.
 */
function laLoiTrungLich(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta as { code?: string } | undefined;
    if (meta?.code === PG_EXCLUSION_VIOLATION) return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(PG_EXCLUSION_VIOLATION) || message.includes('RoomBooking_no_overlap');
}
