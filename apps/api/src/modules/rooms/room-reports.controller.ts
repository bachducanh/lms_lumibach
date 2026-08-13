import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomReportQuerySchema, type RoomReportQuery } from '@lumibach/types';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { zodQuery } from '../../common/pipes/zod-query.pipe';
import { RoomReportsService } from './room-reports.service';

/** Báo cáo sử dụng phòng — chỉ ADMIN, vì gộp dữ liệu của mọi người dùng. */
@ApiTags('room-reports')
@Roles('ADMIN')
@Controller({ path: 'rooms/reports', version: '1' })
export class RoomReportsController {
  constructor(private readonly service: RoomReportsService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Tần suất sử dụng theo phòng / tổ chuyên môn / tháng (ADMIN)' })
  usage(@Query(zodQuery(RoomReportQuerySchema)) query: RoomReportQuery) {
    return this.service.usage(query);
  }

  @Get('no-show')
  @ApiOperation({ summary: 'Danh sách đơn không đến nhận (ADMIN)' })
  noShow(@Query(zodQuery(RoomReportQuerySchema)) query: RoomReportQuery) {
    return this.service.noShow(query);
  }

  @Get('discrepancies')
  @ApiOperation({ summary: 'Danh sách bàn giao có số liệu trả thiếu (ADMIN)' })
  discrepancies(@Query(zodQuery(RoomReportQuerySchema)) query: RoomReportQuery) {
    return this.service.discrepancies(query);
  }
}
