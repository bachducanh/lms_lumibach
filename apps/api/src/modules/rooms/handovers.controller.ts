import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateHandoverFieldBodySchema,
  HandoverFieldsQuerySchema,
  SubmitHandoverBodySchema,
  UpdateHandoverFieldBodySchema,
  type CreateHandoverFieldBody,
  type HandoverFieldsQuery,
  type SubmitHandoverBody,
  type UpdateHandoverFieldBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { HandoverFieldsService } from './handover-fields.service';
import { HandoversService } from './handovers.service';

/** Cấu hình trường bàn giao. Đọc: mọi vai trò dùng phòng. Ghi: chỉ ADMIN. */
@ApiTags('handover-fields')
@Roles('TEACHER', 'TA')
@Controller({ path: 'handover-fields', version: '1' })
export class HandoverFieldsController {
  constructor(private readonly service: HandoverFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'Trường bàn giao áp dụng cho một phòng' })
  list(@Query(zodQuery(HandoverFieldsQuerySchema)) query: HandoverFieldsQuery) {
    return this.service.list(query);
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Tạo trường bàn giao (ADMIN)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateHandoverFieldBodySchema)) body: CreateHandoverFieldBody
  ) {
    return this.service.create(user, body);
  }

  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Sửa trường bàn giao (ADMIN)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateHandoverFieldBodySchema)) body: UpdateHandoverFieldBody
  ) {
    return this.service.update(user, id, body);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá trường bàn giao, hoặc ẩn nếu đã có dữ liệu (ADMIN)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}

/** Nhận phòng và trả phòng. Chỉ chính người mượn thao tác được. */
@ApiTags('handovers')
@Roles('TEACHER', 'TA')
@Controller({ path: 'room-bookings/:bookingId', version: '1' })
export class HandoversController {
  constructor(private readonly service: HandoversService) {}

  @Get('handovers')
  @ApiOperation({ summary: 'Dữ liệu bàn giao của đơn, kèm bảng đối chiếu' })
  summary(@CurrentUser() user: AuthUser, @Param('bookingId') bookingId: string) {
    return this.service.getSummary(user, bookingId);
  }

  @Get('handover-fields/:type')
  @ApiOperation({ summary: 'Trường cần điền cho lượt nhận hoặc trả phòng' })
  fields(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Param('type') type: string
  ) {
    const loai = type.toUpperCase() === 'CHECKOUT' ? 'CHECKOUT' : 'CHECKIN';
    return this.service.fieldsForBooking(user, bookingId, loai);
  }

  @Post('checkin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nhận phòng' })
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body(zodBody(SubmitHandoverBodySchema)) body: SubmitHandoverBody
  ) {
    return this.service.checkIn(user, bookingId, body);
  }

  @Post('checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trả phòng, tự so sánh số liệu với lúc nhận' })
  checkOut(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Body(zodBody(SubmitHandoverBodySchema)) body: SubmitHandoverBody
  ) {
    return this.service.checkOut(user, bookingId, body);
  }
}
