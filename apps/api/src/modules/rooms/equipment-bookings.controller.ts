import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BulkApproveBodySchema,
  CreateEquipmentBookingBodySchema,
  EquipmentBookingsQuerySchema,
  PendingBookingsQuerySchema,
  RejectRoomBookingBodySchema,
  UpdateEquipmentBookingBodySchema,
  type BulkApproveBody,
  type CreateEquipmentBookingBody,
  type EquipmentBookingsQuery,
  type PendingBookingsQuery,
  type RejectRoomBookingBody,
  type UpdateEquipmentBookingBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { EquipmentBookingsService } from './equipment-bookings.service';

@ApiTags('equipment-bookings')
@Roles('TEACHER', 'TA')
@Controller({ path: 'equipment-bookings', version: '1' })
export class EquipmentBookingsController {
  constructor(private readonly service: EquipmentBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Đơn mượn thiết bị trong một khoảng thời gian' })
  list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(EquipmentBookingsQuerySchema)) query: EquipmentBookingsQuery
  ) {
    return this.service.list(user, query);
  }

  @Roles('ADMIN')
  @Get('pending')
  @ApiOperation({ summary: 'Hàng chờ duyệt mượn thiết bị (ADMIN)' })
  listPending(@Query(zodQuery(PendingBookingsQuerySchema)) query: PendingBookingsQuery) {
    return this.service.listPending(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một đơn mượn thiết bị' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đơn mượn thiết bị' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateEquipmentBookingBodySchema)) body: CreateEquipmentBookingBody
  ) {
    return this.service.create(user, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa đơn mượn thiết bị của mình' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateEquipmentBookingBodySchema)) body: UpdateEquipmentBookingBody
  ) {
    return this.service.update(user, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy đơn mượn thiết bị của mình' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }

  @Post(':id/checkin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận đã nhận thiết bị' })
  checkIn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.checkIn(user, id);
  }

  @Post(':id/checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận đã trả thiết bị' })
  checkOut(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.checkOut(user, id);
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Duyệt đơn mượn thiết bị (ADMIN)' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Từ chối đơn mượn thiết bị (ADMIN)' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(RejectRoomBookingBodySchema)) body: RejectRoomBookingBody
  ) {
    return this.service.reject(user, id, body);
  }

  @Roles('ADMIN')
  @Post('bulk-approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Duyệt hàng loạt đơn mượn thiết bị (ADMIN)' })
  bulkApprove(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(BulkApproveBodySchema)) body: BulkApproveBody
  ) {
    return this.service.bulkApprove(user, body.ids);
  }

  @Roles('ADMIN')
  @Post(':id/confirm-return')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận đã nhận lại thiết bị (ADMIN)' })
  confirmReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.confirmReturn(user, id);
  }
}
