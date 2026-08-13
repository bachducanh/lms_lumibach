import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@lumibach/db';
import type {
  CreateHandoverFieldBody,
  HandoverFieldDto,
  HandoverFieldsQuery,
  UpdateHandoverFieldBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const FIELD_SELECT = {
  id: true,
  roomId: true,
  key: true,
  label: true,
  dataType: true,
  options: true,
  isRequired: true,
  appliesTo: true,
  sortOrder: true,
  isActive: true,
} as const;

type FieldRow = Prisma.HandoverFieldGetPayload<{ select: typeof FIELD_SELECT }>;

/**
 * Tham số lọc trường. Rộng hơn `HandoverFieldsQuery` (kiểu sau khi Zod áp giá
 * trị mặc định) để các service khác gọi nội bộ mà không phải truyền đủ mọi khoá.
 */
type ListFieldsInput = Partial<HandoverFieldsQuery>;

@Injectable()
export class HandoverFieldsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  /**
   * Trường bàn giao áp dụng cho một phòng: gộp trường dùng chung (roomId null)
   * với trường riêng của phòng.
   *
   * Trường riêng GHI ĐÈ trường dùng chung khi trùng `key` — nhờ vậy admin đổi
   * nhãn hoặc kiểu dữ liệu cho riêng một phòng mà không phải bỏ trường chung.
   */
  async list(query: ListFieldsInput): Promise<HandoverFieldDto[]> {
    const rows = await this.prisma.handoverField.findMany({
      where: {
        OR: [{ roomId: null }, ...(query.roomId ? [{ roomId: query.roomId }] : [])],
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.applies ? { appliesTo: { in: [query.applies, 'BOTH'] } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: FIELD_SELECT,
    });

    const theoKhoa = new Map<string, FieldRow>();
    for (const row of rows) {
      const daCo = theoKhoa.get(row.key);
      // Bản của phòng thắng bản dùng chung.
      if (!daCo || (daCo.roomId === null && row.roomId !== null)) {
        theoKhoa.set(row.key, row);
      }
    }

    return [...theoKhoa.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'vi'))
      .map(toDto);
  }

  async create(user: AuthUser, body: CreateHandoverFieldBody): Promise<HandoverFieldDto> {
    const roomId = body.roomId ?? null;

    if (roomId) {
      const room = await this.prisma.functionRoom.findFirst({
        where: { id: roomId, deletedAt: null },
        select: { id: true },
      });
      if (!room) throw new NotFoundException('Phòng không tồn tại.');
    }

    // @@unique([roomId, key]) không chặn được khi roomId là NULL (Postgres coi
    // mỗi NULL là một giá trị riêng), nên kiểm tay cho nhánh dùng chung.
    const daTonTai = await this.prisma.handoverField.findFirst({
      where: { roomId, key: body.key },
      select: { id: true },
    });
    if (daTonTai) {
      throw new ConflictException(
        roomId
          ? `Phòng này đã có trường bàn giao với khoá "${body.key}".`
          : `Đã có trường bàn giao dùng chung với khoá "${body.key}".`
      );
    }

    const created = await this.prisma.handoverField.create({
      data: {
        roomId,
        key: body.key,
        label: body.label,
        dataType: body.dataType,
        options: body.dataType === 'SELECT' ? body.options : undefined,
        isRequired: body.isRequired,
        appliesTo: body.appliesTo,
        sortOrder: body.sortOrder,
      },
      select: FIELD_SELECT,
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'HANDOVER_FIELD_CREATE',
      resource: 'HandoverField',
      resourceId: created.id,
      metadata: { roomId, key: body.key, dataType: body.dataType },
    });

    return toDto(created);
  }

  async update(
    user: AuthUser,
    id: string,
    body: UpdateHandoverFieldBody
  ): Promise<HandoverFieldDto> {
    const truoc = await this.prisma.handoverField.findUnique({
      where: { id },
      select: FIELD_SELECT,
    });
    if (!truoc) throw new NotFoundException('Không tìm thấy trường bàn giao.');

    // Cố ý KHÔNG cho đổi `key` và `dataType`: các lượt bàn giao đã ghi giá trị
    // theo khoá và kiểu cũ, đổi đi thì dữ liệu lịch sử không đọc lại được nữa.
    if (body.options !== undefined && truoc.dataType !== 'SELECT') {
      throw new BadRequestException('Chỉ trường dạng chọn mới có danh sách lựa chọn.');
    }
    if (truoc.dataType === 'SELECT' && body.options !== undefined && body.options !== null) {
      if (body.options.length < 2) {
        throw new BadRequestException('Trường dạng chọn cần ít nhất 2 lựa chọn.');
      }
    }

    const sau = await this.prisma.handoverField.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.options !== undefined ? { options: body.options ?? Prisma.DbNull } : {}),
        ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
        ...(body.appliesTo !== undefined ? { appliesTo: body.appliesTo } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      select: FIELD_SELECT,
    });

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: 'HANDOVER_FIELD_UPDATE',
      resource: 'HandoverField',
      resourceId: id,
      changes: { truoc, sau },
    });

    return toDto(sau);
  }

  /**
   * Ẩn trường thay vì xoá khi nó đã được dùng trong một lượt bàn giao — xoá
   * thật sẽ làm mất nhãn của dữ liệu lịch sử, khi đó `fieldValues` chỉ còn là
   * những khoá trần không ai đọc nổi.
   */
  async remove(user: AuthUser, id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    const field = await this.prisma.handoverField.findUnique({
      where: { id },
      select: { id: true, key: true, roomId: true },
    });
    if (!field) throw new NotFoundException('Không tìm thấy trường bàn giao.');

    const daDung = await this.daDuocDungTrongBanGiao(field.key);

    if (daDung) {
      await this.prisma.handoverField.update({ where: { id }, data: { isActive: false } });
    } else {
      await this.prisma.handoverField.delete({ where: { id } });
    }

    this.audit.log({
      userId: user.id,
      userRole: user.role,
      action: daDung ? 'HANDOVER_FIELD_DEACTIVATE' : 'HANDOVER_FIELD_DELETE',
      resource: 'HandoverField',
      resourceId: id,
      metadata: { key: field.key, roomId: field.roomId },
    });

    return { deleted: !daDung, deactivated: daDung };
  }

  /** Có lượt bàn giao nào đã ghi giá trị cho khoá này chưa. */
  private async daDuocDungTrongBanGiao(key: string): Promise<boolean> {
    const soLuong = await this.prisma.handover.count({
      where: { fieldValues: { path: [key], not: Prisma.DbNull } },
    });
    return soLuong > 0;
  }
}

function toDto(row: FieldRow): HandoverFieldDto {
  return {
    id: row.id,
    roomId: row.roomId,
    key: row.key,
    label: row.label,
    dataType: row.dataType,
    options: Array.isArray(row.options) ? (row.options as string[]) : null,
    isRequired: row.isRequired,
    appliesTo: row.appliesTo,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isShared: row.roomId === null,
  };
}
