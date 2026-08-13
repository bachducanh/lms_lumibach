import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@lumibach/db';
import {
  BLOCKING_BOOKING_STATUSES,
  DEFAULT_ROOM_BOOKING_SETTING,
  parseHHmm,
  type CreateEquipmentBody,
  type CreateRoomBody,
  type CreateRoomRuleBody,
  type RoomEquipmentItem,
  type RoomBookingSettingDto,
  type RoomDetail,
  type RoomListItem,
  type RoomRuleDto,
  type RoomsQuery,
  type StaffProfileDto,
  type UpdateEquipmentBody,
  type UpdateRoomBody,
  type UpdateRoomBookingSettingBody,
  type UpdateStaffProfileBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const EQUIPMENT_SELECT = {
  id: true,
  name: true,
  code: true,
  unit: true,
  totalQuantity: true,
  description: true,
  isActive: true,
} as const;

const SETTING_SELECT = {
  openTime: true,
  closeTime: true,
  slotStepMinutes: true,
  minDurationMinutes: true,
  maxDurationMinutes: true,
  maxAdvanceDays: true,
  allowWeekend: true,
  checkinWindowMinutes: true,
  minPhotosPerHandover: true,
  maxPhotosPerHandover: true,
  photoRetentionMonths: true,
} as const;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  // ── Phòng chức năng ──────────────────────────────────────────

  async listRooms(user: AuthUser, query: RoomsQuery): Promise<RoomListItem[]> {
    const isAdmin = user.role === 'ADMIN';
    // Chỉ admin mới thấy phòng đã ẩn; giáo viên gửi includeInactive=true cũng
    // không được — lọc ở đây chứ không tin tham số từ client.
    const includeInactive = isAdmin && query.includeInactive;

    const rooms = await this.prisma.functionRoom.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        capacity: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: {
            equipment: { where: { isActive: true, deletedAt: null } },
            bookings: { where: { status: 'PENDING' } },
          },
        },
      },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      code: room.code,
      location: room.location,
      capacity: room.capacity,
      description: room.description,
      isActive: room.isActive,
      sortOrder: room.sortOrder,
      equipmentCount: room._count.equipment,
      // Số đơn chờ duyệt là thông tin điều hành, chỉ admin cần thấy.
      pendingBookingCount: isAdmin ? room._count.bookings : null,
    }));
  }

  async getRoomByCode(user: AuthUser, code: string): Promise<RoomDetail> {
    const isAdmin = user.role === 'ADMIN';

    const room = await this.prisma.functionRoom.findFirst({
      where: {
        code,
        deletedAt: null,
        ...(isAdmin ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        capacity: true,
        description: true,
        isActive: true,
        sortOrder: true,
        equipment: {
          where: { deletedAt: null, ...(isAdmin ? {} : { isActive: true }) },
          orderBy: { name: 'asc' },
          select: EQUIPMENT_SELECT,
        },
        // Bản nội quy mới nhất — lấy 1 dòng version cao nhất.
        rules: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true, content: true, createdAt: true },
        },
        setting: { select: SETTING_SELECT },
        _count: {
          select: {
            equipment: { where: { isActive: true, deletedAt: null } },
            bookings: { where: { status: 'PENDING' } },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng chức năng này');
    }

    const setting = await this.resolveSetting(room.setting);
    const currentRule = room.rules[0];

    return {
      id: room.id,
      name: room.name,
      code: room.code,
      location: room.location,
      capacity: room.capacity,
      description: room.description,
      isActive: room.isActive,
      sortOrder: room.sortOrder,
      equipmentCount: room._count.equipment,
      pendingBookingCount: isAdmin ? room._count.bookings : null,
      currentRule: currentRule
        ? {
            version: currentRule.version,
            content: currentRule.content,
            createdAt: currentRule.createdAt.toISOString(),
          }
        : null,
      equipment: room.equipment,
      setting,
    };
  }

  async createRoom(user: AuthUser, body: CreateRoomBody): Promise<RoomDetail> {
    try {
      const created = await this.prisma.functionRoom.create({
        data: {
          name: body.name,
          code: body.code,
          location: body.location ?? null,
          capacity: body.capacity ?? null,
          description: body.description ?? null,
          isActive: body.isActive,
          sortOrder: body.sortOrder,
        },
        select: { id: true, code: true },
      });

      this.audit.log({
        userId: user.id,
        userRole: user.role,
        action: 'FUNCTION_ROOM_CREATE',
        resource: 'FunctionRoom',
        resourceId: created.id,
        metadata: { code: body.code, name: body.name },
      });

      return this.getRoomByCode(user, created.code);
    } catch (err) {
      if (isUniqueConstraint(err)) {
        throw new ConflictException(`Mã phòng "${body.code}" đã được sử dụng.`);
      }
      throw err;
    }
  }

  async updateRoom(user: AuthUser, id: string, body: UpdateRoomBody): Promise<RoomDetail> {
    const before = await this.requireRoomById(id);

    try {
      const updated = await this.prisma.functionRoom.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: { code: true },
      });

      this.audit.log({
        userId: user.id,
        userRole: user.role,
        action: 'FUNCTION_ROOM_UPDATE',
        resource: 'FunctionRoom',
        resourceId: id,
        changes: { before, after: body },
      });

      return this.getRoomByCode(user, updated.code);
    } catch (err) {
      if (isUniqueConstraint(err)) {
        throw new ConflictException(`Mã phòng "${body.code ?? before.code}" đã được sử dụng.`);
      }
      throw err;
    }
  }

  async removeRoom(
    user: AuthUser,
    id: string
  ): Promise<{ deleted: boolean; deactivated: boolean }> {
    const room = await this.requireRoomById(id);

    const [roomBookings, equipmentBookings] = await Promise.all([
      this.prisma.roomBooking.count({
        where: { roomId: id, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
      }),
      this.prisma.equipmentBooking.count({
        where: { roomId: id, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
      }),
    ]);

    if (roomBookings + equipmentBookings > 0) {
      throw new ConflictException(
        'Phòng đang có đơn mượn còn giữ chỗ, hãy xử lý xong trước khi xóa.'
      );
    }

    await this.prisma.functionRoom.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'FUNCTION_ROOM_DELETE',
      resource: 'FunctionRoom',
      resourceId: id,
      metadata: { code: room.code, name: room.name },
    });

    return { deleted: false, deactivated: true };
  }

  async createRule(user: AuthUser, roomId: string, body: CreateRoomRuleBody): Promise<RoomRuleDto> {
    await this.requireRoomById(roomId);

    const latest = await this.prisma.roomRule.findFirst({
      where: { roomId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const created = await this.prisma.roomRule.create({
      data: {
        roomId,
        content: body.content,
        version: (latest?.version ?? 0) + 1,
        updatedById: user.id,
      },
      select: { version: true, content: true, createdAt: true },
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_RULE_CREATE',
      resource: 'RoomRule',
      resourceId: `${roomId}:${created.version}`,
      metadata: { roomId, version: created.version },
    });

    return {
      version: created.version,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateSetting(
    user: AuthUser,
    roomId: string,
    body: UpdateRoomBookingSettingBody
  ): Promise<RoomBookingSettingDto> {
    await this.requireRoomById(roomId);

    const existing = await this.prisma.roomBookingSetting.findUnique({
      where: { roomId },
      select: SETTING_SELECT,
    });
    const effective = await this.resolveSetting(existing);
    const next = { ...effective, ...body };
    this.assertSetting(next);

    const { isDefault: _isDefault, ...data } = next;
    const saved = await this.prisma.roomBookingSetting.upsert({
      where: { roomId },
      create: { roomId, ...data },
      update: data,
      select: SETTING_SELECT,
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'ROOM_BOOKING_SETTING_UPDATE',
      resource: 'RoomBookingSetting',
      resourceId: roomId,
      changes: { before: effective, after: next },
    });

    return { ...saved, isDefault: false };
  }

  async createEquipment(
    user: AuthUser,
    roomId: string,
    body: CreateEquipmentBody
  ): Promise<RoomEquipmentItem> {
    await this.requireRoomById(roomId);

    const created = await this.prisma.equipment.create({
      data: {
        roomId,
        name: body.name,
        code: body.code ?? null,
        unit: body.unit,
        totalQuantity: body.totalQuantity,
        description: body.description ?? null,
        isActive: body.isActive,
      },
      select: EQUIPMENT_SELECT,
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_CREATE',
      resource: 'Equipment',
      resourceId: created.id,
      metadata: { roomId, name: body.name },
    });

    return created;
  }

  async updateEquipment(
    user: AuthUser,
    id: string,
    body: UpdateEquipmentBody
  ): Promise<RoomEquipmentItem> {
    const before = await this.requireEquipment(id);

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.totalQuantity !== undefined ? { totalQuantity: body.totalQuantity } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      select: EQUIPMENT_SELECT,
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'EQUIPMENT_UPDATE',
      resource: 'Equipment',
      resourceId: id,
      changes: { before, after: body },
    });

    return updated;
  }

  async removeEquipment(
    user: AuthUser,
    id: string
  ): Promise<{ deleted: boolean; deactivated: boolean }> {
    const equipment = await this.requireEquipment(id);
    const usageCount = await this.prisma.equipmentBookingItem.count({ where: { equipmentId: id } });

    if (usageCount > 0) {
      await this.prisma.equipment.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    } else {
      await this.prisma.equipment.delete({ where: { id } });
    }

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: usageCount > 0 ? 'EQUIPMENT_DEACTIVATE' : 'EQUIPMENT_DELETE',
      resource: 'Equipment',
      resourceId: id,
      metadata: { roomId: equipment.roomId, name: equipment.name },
    });

    return { deleted: usageCount === 0, deactivated: usageCount > 0 };
  }

  /**
   * Tham số đặt phòng có hiệu lực: bản riêng của phòng ghi đè bản mặc định toàn
   * hệ thống (roomId = null); chưa có bản nào thì rơi về hằng số trong code.
   */
  private async resolveSetting(
    roomSetting: Record<keyof typeof SETTING_SELECT, unknown> | null
  ): Promise<RoomBookingSettingDto> {
    if (roomSetting) {
      return { ...(roomSetting as Omit<RoomBookingSettingDto, 'isDefault'>), isDefault: false };
    }

    const globalSetting = await this.prisma.roomBookingSetting.findFirst({
      where: { roomId: null },
      select: SETTING_SELECT,
    });

    return {
      ...(globalSetting ?? DEFAULT_ROOM_BOOKING_SETTING),
      isDefault: true,
    };
  }

  /** Số đơn đang giữ chỗ của một phòng — dùng để chặn xoá/ẩn phòng ở phase sau. */
  async countBlockingBookings(roomId: string): Promise<number> {
    return this.prisma.roomBooking.count({
      where: { roomId, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
    });
  }

  private async requireRoomById(id: string) {
    const room = await this.prisma.functionRoom.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        capacity: true,
        description: true,
        isActive: true,
        sortOrder: true,
      },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng chức năng.');
    return room;
  }

  private async requireEquipment(id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      select: { ...EQUIPMENT_SELECT, roomId: true },
    });
    if (!equipment) throw new NotFoundException('Không tìm thấy thiết bị.');
    return equipment;
  }

  private assertSetting(setting: RoomBookingSettingDto): void {
    const open = parseHHmm(setting.openTime);
    const close = parseHHmm(setting.closeTime);
    if (open === null || close === null || open >= close) {
      throw new BadRequestException('Giờ mở cửa phải trước giờ đóng cửa.');
    }
    if (setting.minDurationMinutes > setting.maxDurationMinutes) {
      throw new BadRequestException('Thời lượng tối thiểu không được lớn hơn thời lượng tối đa.');
    }
    if (setting.minPhotosPerHandover > setting.maxPhotosPerHandover) {
      throw new BadRequestException('Số ảnh tối thiểu không được lớn hơn số ảnh tối đa.');
    }
  }

  // ── Hồ sơ công tác (giáo viên tự điền) ───────────────────────

  async getStaffProfile(user: AuthUser): Promise<StaffProfileDto> {
    const profile = await this.prisma.staffProfile.findUnique({
      where: { userId: user.id },
      select: { staffCode: true, department: true },
    });

    return profile ?? { staffCode: null, department: null };
  }

  async updateStaffProfile(user: AuthUser, body: UpdateStaffProfileBody): Promise<StaffProfileDto> {
    // Chuỗi rỗng sau khi trim coi như bỏ trống, để không lưu '' lẫn lộn với null.
    const staffCode = body.staffCode?.length ? body.staffCode : null;
    const department = body.department?.length ? body.department : null;

    const saved = await this.prisma.staffProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, staffCode, department },
      update: { staffCode, department },
      select: { staffCode: true, department: true },
    });

    return saved;
  }
}

function isUniqueConstraint(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
