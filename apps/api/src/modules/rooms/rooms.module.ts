import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { EmailModule } from '../../common/email/email.module';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EquipmentBookingsController } from './equipment-bookings.controller';
import { EquipmentBookingsService } from './equipment-bookings.service';
import { HandoverPhotosController } from './handover-photos.controller';
import { HandoverFieldsService } from './handover-fields.service';
import { HandoverFieldsController, HandoversController } from './handovers.controller';
import { HandoversService } from './handovers.service';
import { RoomBookingNotifier } from './room-booking-notifier.service';
import { RoomBookingsController } from './room-bookings.controller';
import { RoomBookingsService } from './room-bookings.service';
import { RoomsController } from './rooms.controller';
import { RoomJobsController } from './room-jobs.controller';
import { RoomJobsService } from './room-jobs.service';
import { RoomReportsController } from './room-reports.controller';
import { RoomReportsService } from './room-reports.service';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuditModule, EmailModule, NotificationsModule, StorageModule],
  controllers: [
    RoomsController,
    RoomBookingsController,
    EquipmentBookingsController,
    HandoverFieldsController,
    HandoversController,
    HandoverPhotosController,
    RoomJobsController,
    RoomReportsController,
  ],
  providers: [
    RoomsService,
    RoomBookingsService,
    EquipmentBookingsService,
    RoomBookingNotifier,
    HandoverFieldsService,
    HandoversService,
    RoomJobsService,
    RoomReportsService,
  ],
  exports: [
    RoomsService,
    RoomBookingsService,
    EquipmentBookingsService,
    HandoverFieldsService,
    HandoversService,
  ],
})
export class RoomsModule {}
