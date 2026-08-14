import {
  BadRequestException,
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
  type CreateEquipmentBookingBody,
  type EquipmentAvailabilityIssue,
  type EquipmentBookingDetail,
  type EquipmentBookingListItem,
  type EquipmentBookingsQuery,
  type PendingBookingsQuery,
  type PendingEquipmentBookingItem,
  type RejectRoomBookingBody,
  type RoomBookingSettingDto,
  type RoomBookingStatusValue,
  type UpdateEquipmentBookingBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { assertBookingWindow } from './booking-rules';
import { assertTransition, availableActionsFor } from './booking-state';

const LIST_INCLUDE = {
  room: { select: { id: true, name: true, code: true } },
  approvedBy: { select: { fullName: true, email: true } },
  items: {
    include: {
      equipment: { select: { id: true, name: true, code: true, unit: true, totalQuantity: true } },
    },
  },
} as const;

type EquipmentBookingWithRelations = Prisma.EquipmentBookingGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

type PrismaLike = PrismaClient | Prisma.TransactionClient;
type RequestedEquipmentItem = { equipmentId: string; quantity: number };

@Injectable()
export class EquipmentBookingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  async list(user: AuthUser, query: EquipmentBookingsQuery): Promise<EquipmentBookingListItem[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() <= from.getTime()) {
      throw new ConflictException('Khoảng thời gian không hợp lệ.');
    }

    const bookings = await this.prisma.equipmentBooking.findMany({
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

    return bookings.map((booking) => this.toListItem(booking, user));
  }

  async listPending(query: PendingBookingsQuery): Promise<PendingEquipmentBookingItem[]> {
    const pending = await this.prisma.equipmentBooking.findMany({
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
    return Promise.all(
      pending.map(async (booking) => ({
        ...this.toListItem(booking, adminUser),
        createdAt: booking.createdAt.toISOString(),
        availabilityIssues: await this.findAvailabilityIssues(
          this.prisma,
          booking.roomId,
          booking.items.map((item) => ({
            equipmentId: item.equipmentId,
            quantity: item.quantity,
          })),
          booking.startAt,
          booking.endAt,
          booking.id
        ),
      }))
    );
  }

  async getById(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireBooking(id);
    return this.toDetail(booking, user);
  }

  async create(user: AuthUser, body: CreateEquipmentBookingBody): Promise<EquipmentBookingDetail> {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    const room = await this.requireBookableRoom(body.roomId);
    const setting = await this.resolveSetting(room.id);

    assertBookingWindow(
      { startAt, endAt },
      { setting, now: new Date(), isAdmin: user.role === 'ADMIN' }
    );

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertEquipmentAvailability(tx, room.id, body.items, startAt, endAt);

      return tx.equipmentBooking.create({
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
          items: {
            create: body.items.map((item) => ({
              equipmentId: item.equipmentId,
              quantity: item.quantity,
            })),
          },
        },
        include: LIST_INCLUDE,
      });
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_CREATE',
      resource: 'EquipmentBooking',
      resourceId: created.id,
      metadata: { roomId: room.id, startAt: body.startAt, endAt: body.endAt },
    });

    return this.getById(user, created.id);
  }

  async update(
    user: AuthUser,
    id: string,
    body: UpdateEquipmentBookingBody
  ): Promise<EquipmentBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);
    const startAt = body.startAt ? new Date(body.startAt) : booking.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : booking.endAt;
    const roomId = body.roomId ?? booking.roomId;

    if (roomId !== booking.roomId && body.items === undefined) {
      throw new BadRequestException('Đổi phòng quản lý thiết bị cần chọn lại danh sách thiết bị.');
    }

    const nextItems =
      body.items ??
      booking.items.map((item) => ({ equipmentId: item.equipmentId, quantity: item.quantity }));

    const changedWindow =
      startAt.getTime() !== booking.startAt.getTime() ||
      endAt.getTime() !== booking.endAt.getTime() ||
      roomId !== booking.roomId ||
      equipmentItemsChanged(nextItems, booking.items);

    let status = booking.status;

    if (changedWindow) {
      status = assertTransition(booking.status, 'reschedule');
      const room = await this.requireBookableRoom(roomId);
      const setting = await this.resolveSetting(room.id);
      assertBookingWindow(
        { startAt, endAt },
        { setting, now: new Date(), isAdmin: user.role === 'ADMIN' }
      );
    } else if (booking.status !== 'PENDING' && booking.status !== 'APPROVED') {
      throw new ConflictException('Đơn đã bắt đầu hoặc đã kết thúc, không sửa được nữa.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.assertEquipmentAvailability(tx, roomId, nextItems, startAt, endAt, id);

      await tx.equipmentBooking.update({
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
          ...(changedWindow && booking.status === 'APPROVED'
            ? { approvedById: null, approvedAt: null }
            : {}),
          ...(body.items !== undefined || roomId !== booking.roomId
            ? {
                items: {
                  deleteMany: {},
                  create: nextItems.map((item) => ({
                    equipmentId: item.equipmentId,
                    quantity: item.quantity,
                  })),
                },
              }
            : {}),
        },
      });
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_UPDATE',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: {
        before: {
          roomId: booking.roomId,
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          status: booking.status,
        },
        after: { roomId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), status },
      },
    });

    return this.getById(user, id);
  }

  async approve(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'approve');

    await this.assertEquipmentAvailability(
      this.prisma,
      booking.roomId,
      booking.items.map((item) => ({ equipmentId: item.equipmentId, quantity: item.quantity })),
      booking.startAt,
      booking.endAt,
      id
    );

    await this.prisma.equipmentBooking.update({
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
      action: 'EQUIPMENT_BOOKING_APPROVE',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
    });

    return this.getById(user, id);
  }

  async reject(
    user: AuthUser,
    id: string,
    body: RejectRoomBookingBody
  ): Promise<EquipmentBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'reject');

    await this.prisma.equipmentBooking.update({
      where: { id },
      data: { status, rejectReason: body.reason, approvedById: user.id, approvedAt: new Date() },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_REJECT',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
      metadata: { reason: body.reason },
    });

    return this.getById(user, id);
  }

  async bulkApprove(user: AuthUser, ids: string[]): Promise<BulkApproveResult> {
    const result: BulkApproveResult = { approved: [], failed: [] };

    for (const id of ids) {
      try {
        await this.approve(user, id);
        result.approved.push(id);
      } catch (err) {
        result.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }
    }

    return result;
  }

  async cancel(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);
    const status = assertTransition(booking.status, 'cancel');

    await this.prisma.equipmentBooking.update({ where: { id }, data: { status } });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_CANCEL',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
    });

    return this.getById(user, id);
  }

  async checkIn(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);
    const status = assertTransition(booking.status, 'checkin');

    await this.prisma.equipmentBooking.update({ where: { id }, data: { status } });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_CHECKIN',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
    });

    return this.getById(user, id);
  }

  async checkOut(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireOwnBooking(user, id);
    const status = assertTransition(booking.status, 'checkout');

    await this.prisma.equipmentBooking.update({ where: { id }, data: { status } });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_CHECKOUT',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
    });

    return this.getById(user, id);
  }

  async confirmReturn(user: AuthUser, id: string): Promise<EquipmentBookingDetail> {
    const booking = await this.requireBooking(id);
    const status = assertTransition(booking.status, 'complete');

    await this.prisma.equipmentBooking.update({
      where: { id },
      data: { status, returnedAt: new Date(), returnedById: user.id },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_BOOKING_RETURNED',
      resource: 'EquipmentBooking',
      resourceId: id,
      changes: { before: booking.status, after: status },
    });

    return this.getById(user, id);
  }

  private async assertEquipmentAvailability(
    prisma: PrismaLike,
    roomId: string,
    items: readonly RequestedEquipmentItem[],
    startAt: Date,
    endAt: Date,
    ignoreBookingId?: string
  ): Promise<void> {
    const issues = await this.findAvailabilityIssues(
      prisma,
      roomId,
      items,
      startAt,
      endAt,
      ignoreBookingId
    );

    if (issues.length === 0) return;

    const detail = issues
      .slice(0, 3)
      .map((issue) => `${issue.equipmentName}: cần ${issue.requested}, còn ${issue.available}`)
      .join('; ');
    throw new ConflictException(
      `Không đủ thiết bị trong khung ${vnRangeLabel(startAt, endAt)}. ${detail}`
    );
  }

  /**
   * Khoá các dòng thiết bị liên quan cho tới hết transaction.
   *
   * BẮT BUỘC gọi trước khi đếm số đã giữ. Khác với mượn phòng — nơi ràng buộc
   * EXCLUDE ở tầng CSDL đỡ cho mọi sai sót — mượn thiết bị không có ràng buộc
   * CSDL nào, tổng số lượng chỉ được kiểm bằng đọc-rồi-ghi. Ở mức cô lập
   * READ COMMITTED (mặc định của Postgres), hai transaction song song cùng đọc
   * thấy "còn 2" rồi cùng ghi, và kho bị mượn quá số máy thật.
   *
   * `ORDER BY id` để hai transaction khoá cùng một tập thiết bị theo cùng thứ
   * tự — khoá ngược chiều nhau là deadlock.
   *
   * Không có tác dụng khi `prisma` là client thường (ngoài transaction): khoá
   * sẽ nhả ngay lập tức. Mọi lối gọi tới đây đều phải nằm trong `$transaction`.
   */
  private async khoaDongThietBi(prisma: PrismaLike, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.$queryRaw`
      SELECT id FROM "Equipment"
      WHERE id IN (${Prisma.join([...ids])})
      ORDER BY id
      FOR UPDATE
    `;
  }

  private async findAvailabilityIssues(
    prisma: PrismaLike,
    roomId: string,
    items: readonly RequestedEquipmentItem[],
    startAt: Date,
    endAt: Date,
    ignoreBookingId?: string
  ): Promise<EquipmentAvailabilityIssue[]> {
    const ids = [...new Set(items.map((item) => item.equipmentId))];
    await this.khoaDongThietBi(prisma, ids);

    const equipmentRows = await prisma.equipment.findMany({
      where: { id: { in: ids }, roomId, deletedAt: null, isActive: true },
      select: { id: true, name: true, totalQuantity: true },
    });
    const equipmentById = new Map(equipmentRows.map((item) => [item.id, item]));

    const reserved = await prisma.equipmentBookingItem.groupBy({
      by: ['equipmentId'],
      where: {
        equipmentId: { in: equipmentRows.map((item) => item.id) },
        booking: {
          roomId,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          status: { in: [...BLOCKING_BOOKING_STATUSES] },
          ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
        },
      },
      _sum: { quantity: true },
    });
    const reservedById = new Map(reserved.map((row) => [row.equipmentId, row._sum.quantity ?? 0]));

    const issues: EquipmentAvailabilityIssue[] = [];
    for (const item of items) {
      const equipment = equipmentById.get(item.equipmentId);
      if (!equipment) {
        issues.push({
          equipmentId: item.equipmentId,
          equipmentName: 'Thiết bị không còn khả dụng',
          requested: item.quantity,
          available: 0,
          totalQuantity: 0,
        });
        continue;
      }

      const available = Math.max(
        0,
        equipment.totalQuantity - (reservedById.get(item.equipmentId) ?? 0)
      );
      if (item.quantity > available) {
        issues.push({
          equipmentId: item.equipmentId,
          equipmentName: equipment.name,
          requested: item.quantity,
          available,
          totalQuantity: equipment.totalQuantity,
        });
      }
    }

    return issues;
  }

  private async requireBookableRoom(roomId: string) {
    const room = await this.prisma.functionRoom.findFirst({
      where: { id: roomId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    if (!room) throw new NotFoundException('Phòng không tồn tại hoặc đang ngừng sử dụng.');
    return room;
  }

  private async requireBooking(id: string): Promise<EquipmentBookingWithRelations> {
    const booking = await this.prisma.equipmentBooking.findUnique({
      where: { id },
      include: LIST_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn mượn thiết bị.');
    return booking;
  }

  private async requireOwnBooking(
    user: AuthUser,
    id: string
  ): Promise<EquipmentBookingWithRelations> {
    const booking = await this.requireBooking(id);
    if (booking.userId !== user.id) {
      throw new ForbiddenException('Bạn chỉ thao tác được trên đơn của chính mình.');
    }
    return booking;
  }

  private async toDetail(
    booking: EquipmentBookingWithRelations,
    user: AuthUser
  ): Promise<EquipmentBookingDetail> {
    return {
      ...this.toListItem(booking, user),
      ruleContent: await this.ruleContent(booking.roomId),
      approvedByName: booking.approvedBy?.fullName ?? booking.approvedBy?.email ?? null,
      approvedAt: booking.approvedAt?.toISOString() ?? null,
      rejectReason: booking.rejectReason,
      returnedAt: booking.returnedAt?.toISOString() ?? null,
      hasDiscrepancy: booking.hasDiscrepancy,
      createdAt: booking.createdAt.toISOString(),
      availableActions: [
        ...availableActionsFor(booking.status, {
          isOwner: booking.userId === user.id,
          isAdmin: user.role === 'ADMIN',
        }),
      ],
    };
  }

  private toListItem(
    booking: EquipmentBookingWithRelations,
    user: AuthUser
  ): EquipmentBookingListItem {
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
      items: booking.items.map((item) => ({
        equipmentId: item.equipmentId,
        equipmentName: item.equipment.name,
        equipmentCode: item.equipment.code,
        unit: item.equipment.unit,
        quantity: item.quantity,
      })),
    };
  }

  /** Nội quy hiện hành của phòng — mỗi phòng một bản, không còn chốt theo đơn. */
  private async ruleContent(roomId: string): Promise<string | null> {
    const rule = await this.prisma.roomRule.findUnique({
      where: { roomId },
      select: { content: true },
    });
    return rule?.content ?? null;
  }

  private async resolveSetting(roomId: string): Promise<RoomBookingSettingDto> {
    const [roomSetting, defaultSetting] = await Promise.all([
      this.prisma.roomBookingSetting.findUnique({ where: { roomId } }),
      this.prisma.roomBookingSetting.findFirst({ where: { roomId: null } }),
    ]);

    const source = roomSetting ?? defaultSetting;
    if (!source) return { ...DEFAULT_ROOM_BOOKING_SETTING, isDefault: true };

    return {
      openTime: source.openTime,
      closeTime: source.closeTime,
      slotStepMinutes: source.slotStepMinutes,
      minDurationMinutes: source.minDurationMinutes,
      maxDurationMinutes: source.maxDurationMinutes,
      maxAdvanceDays: source.maxAdvanceDays,
      allowWeekend: source.allowWeekend,
      checkinWindowMinutes: source.checkinWindowMinutes,
      minPhotosPerHandover: source.minPhotosPerHandover,
      maxPhotosPerHandover: source.maxPhotosPerHandover,
      photoRetentionMonths: source.photoRetentionMonths,
      isDefault: roomSetting === null,
    };
  }
}

function equipmentItemsChanged(
  next: readonly RequestedEquipmentItem[],
  current: readonly { equipmentId: string; quantity: number }[]
): boolean {
  const serialize = (items: readonly { equipmentId: string; quantity: number }[]) =>
    [...items]
      .map((item) => `${item.equipmentId}:${item.quantity}`)
      .sort()
      .join('|');
  return serialize(next) !== serialize(current);
}
