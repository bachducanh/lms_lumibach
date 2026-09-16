import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EquipmentReportQuerySchema,
  OutstandingEquipmentQuerySchema,
  type EquipmentReportQuery,
  type OutstandingEquipmentQuery,
} from '@lumibach/types';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodQuery } from '../../common/pipes/zod-query.pipe';
import { EquipmentReportsService } from './equipment-reports.service';

/**
 * Báo cáo mượn thiết bị — chỉ ADMIN, vì gộp dữ liệu của mọi người dùng.
 *
 * Đặt dưới `equipment-bookings/reports` chứ không phải `:id` của controller
 * đơn mượn: đường dẫn ba đoạn nên không đụng tham số một đoạn ở đó.
 */
@ApiTags('equipment-reports')
@Roles('ADMIN')
@Controller({ path: 'equipment-bookings/reports', version: '1' })
export class EquipmentReportsController {
  constructor(private readonly service: EquipmentReportsService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Tần suất mượn theo thiết bị / phòng / tổ chuyên môn / tháng (ADMIN)' })
  usage(@Query(zodQuery(EquipmentReportQuerySchema)) query: EquipmentReportQuery) {
    return this.service.usage(query);
  }

  @Get('no-show')
  @ApiOperation({ summary: 'Danh sách đơn mượn thiết bị không đến nhận (ADMIN)' })
  noShow(@Query(zodQuery(EquipmentReportQuerySchema)) query: EquipmentReportQuery) {
    return this.service.noShow(query);
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'Thiết bị đang mượn và quá hạn trả, tính tại thời điểm xem (ADMIN)' })
  outstanding(@Query(zodQuery(OutstandingEquipmentQuerySchema)) query: OutstandingEquipmentQuery) {
    return this.service.outstanding(query);
  }
}
