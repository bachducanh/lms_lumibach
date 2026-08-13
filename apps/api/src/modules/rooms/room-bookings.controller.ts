import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BulkApproveBodySchema,
  CreateRoomBookingBodySchema,
  PendingBookingsQuerySchema,
  RejectRoomBookingBodySchema,
  RoomBookingsQuerySchema,
  UpdateRoomBookingBodySchema,
  type BulkApproveBody,
  type CreateRoomBookingBody,
  type PendingBookingsQuery,
  type RejectRoomBookingBody,
  type RoomBookingsQuery,
  type UpdateRoomBookingBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { RoomBookingsService } from './room-bookings.service';

/** Xem ghi chú phân quyền ở RoomsController — học sinh bị 403 ở mọi endpoint. */
@ApiTags('room-bookings')
@Roles('TEACHER', 'TA')
@Controller({ path: 'room-bookings', version: '1' })
export class RoomBookingsController {
  constructor(private readonly service: RoomBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Đơn mượn phòng trong một khoảng thời gian (nguồn cho lịch)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(RoomBookingsQuerySchema)) query: RoomBookingsQuery
  ) {
    return this.service.list(user, query);
  }

  // Đặt TRƯỚC ':id', nếu không 'pending' sẽ bị hiểu là một mã đơn.
  @Roles('ADMIN')
  @Get('pending')
  @ApiOperation({ summary: 'Hàng chờ duyệt (ADMIN)' })
  listPending(@Query(zodQuery(PendingBookingsQuerySchema)) query: PendingBookingsQuery) {
    return this.service.listPending(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một đơn mượn phòng' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đơn mượn phòng' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateRoomBookingBodySchema)) body: CreateRoomBookingBody
  ) {
    return this.service.create(user, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa đơn của mình (đổi giờ/phòng sẽ phải duyệt lại)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateRoomBookingBodySchema)) body: UpdateRoomBookingBody
  ) {
    return this.service.update(user, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Huỷ đơn của mình' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }

  // ── Thao tác của quản trị viên ───────────────────────────────
  // @Roles('ADMIN') ở từng route ghi đè @Roles('TEACHER','TA') của cả lớp:
  // giáo viên và trợ giảng bị 403, chỉ ADMIN đi qua.

  @Roles('ADMIN')
  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Duyệt đơn (ADMIN)' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Từ chối đơn, bắt buộc nêu lý do (ADMIN)' })
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
  @ApiOperation({ summary: 'Duyệt hàng loạt, báo rõ đơn nào trượt (ADMIN)' })
  bulkApprove(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(BulkApproveBodySchema)) body: BulkApproveBody
  ) {
    return this.service.bulkApprove(user, body.ids);
  }

  @Roles('ADMIN')
  @Post(':id/confirm-key-return')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận đã nhận lại chìa khoá → hoàn tất đơn (ADMIN)' })
  confirmKeyReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.confirmKeyReturn(user, id);
  }
}
