import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateEquipmentBodySchema,
  CreateRoomBodySchema,
  RoomsQuerySchema,
  UpsertRoomRuleBodySchema,
  UpdateEquipmentBodySchema,
  UpdateRoomBodySchema,
  UpdateRoomBookingSettingBodySchema,
  UpdateStaffProfileBodySchema,
  type CreateEquipmentBody,
  type CreateRoomBody,
  type RoomsQuery,
  type UpdateEquipmentBody,
  type UpdateRoomBody,
  type UpdateRoomBookingSettingBody,
  type UpdateStaffProfileBody,
  type UpsertRoomRuleBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { RoomsService } from './rooms.service';

/**
 * Module "Phòng chức năng".
 *
 * Phân quyền: @Roles('TEACHER', 'TA') trên cả controller → học sinh bị 403 ở
 * MỌI endpoint, kể cả khi gọi thẳng API. ADMIN tự động đi qua RolesGuard.
 * Việc ẩn tab trên sidebar chỉ là lớp trang trí, không phải lớp bảo vệ.
 */
@ApiTags('rooms')
@Roles('TEACHER', 'TA')
@Controller({ version: '1' })
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Danh sách phòng chức năng' })
  listRooms(@CurrentUser() user: AuthUser, @Query(zodQuery(RoomsQuerySchema)) query: RoomsQuery) {
    return this.service.listRooms(user, query);
  }

  @Roles('ADMIN')
  @Post('rooms')
  @ApiOperation({ summary: 'Tạo phòng chức năng (ADMIN)' })
  createRoom(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateRoomBodySchema)) body: CreateRoomBody
  ) {
    return this.service.createRoom(user, body);
  }

  @Roles('ADMIN')
  @Patch('rooms/:id')
  @ApiOperation({ summary: 'Sửa phòng chức năng (ADMIN)' })
  updateRoom(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateRoomBodySchema)) body: UpdateRoomBody
  ) {
    return this.service.updateRoom(user, id, body);
  }

  @Roles('ADMIN')
  @Delete('rooms/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa mềm phòng chức năng nếu không còn đơn giữ chỗ (ADMIN)' })
  removeRoom(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeRoom(user, id);
  }

  @Roles('ADMIN')
  @Put('rooms/:id/rule')
  @ApiOperation({ summary: 'Ghi đè nội quy của phòng (ADMIN)' })
  upsertRule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpsertRoomRuleBodySchema)) body: UpsertRoomRuleBody
  ) {
    return this.service.upsertRule(user, id, body);
  }

  @Roles('ADMIN')
  @Patch('rooms/:id/setting')
  @ApiOperation({ summary: 'Cập nhật tham số đặt phòng riêng của phòng (ADMIN)' })
  updateSetting(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateRoomBookingSettingBodySchema)) body: UpdateRoomBookingSettingBody
  ) {
    return this.service.updateSetting(user, id, body);
  }

  @Roles('ADMIN')
  @Post('rooms/:id/equipment')
  @ApiOperation({ summary: 'Thêm thiết bị vào phòng (ADMIN)' })
  createEquipment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(CreateEquipmentBodySchema)) body: CreateEquipmentBody
  ) {
    return this.service.createEquipment(user, id, body);
  }

  @Roles('ADMIN')
  @Patch('rooms/equipment/:id')
  @ApiOperation({ summary: 'Sửa thiết bị (ADMIN)' })
  updateEquipment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateEquipmentBodySchema)) body: UpdateEquipmentBody
  ) {
    return this.service.updateEquipment(user, id, body);
  }

  @Roles('ADMIN')
  @Delete('rooms/equipment/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa hoặc ẩn thiết bị nếu đã có lịch sử mượn (ADMIN)' })
  removeEquipment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeEquipment(user, id);
  }

  @Get('staff-profile')
  @ApiOperation({ summary: 'Hồ sơ công tác của tôi (mã nhân viên, tổ chuyên môn)' })
  getStaffProfile(@CurrentUser() user: AuthUser) {
    return this.service.getStaffProfile(user);
  }

  @Patch('staff-profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ công tác của tôi' })
  updateStaffProfile(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(UpdateStaffProfileBodySchema)) body: UpdateStaffProfileBody
  ) {
    return this.service.updateStaffProfile(user, body);
  }

  @Get('rooms/:code')
  @ApiOperation({ summary: 'Chi tiết phòng + nội quy hiện hành + thiết bị' })
  getRoom(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.service.getRoomByCode(user, code);
  }
}
