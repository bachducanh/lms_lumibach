-- CreateEnum
CREATE TYPE "RoomBookingStatus" AS ENUM ('PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'REJECTED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "HandoverFieldType" AS ENUM ('NUMBER', 'TEXT', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "HandoverFieldApplies" AS ENUM ('CHECKIN', 'CHECKOUT', 'BOTH');

-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('CHECKIN', 'CHECKOUT');

-- CreateEnum
CREATE TYPE "BookableType" AS ENUM ('ROOM', 'EQUIPMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ROOM_BOOKING_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_BOOKING_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_BOOKING_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_BOOKING_CHECKED_OUT';
ALTER TYPE "NotificationType" ADD VALUE 'ROOM_BOOKING_NO_SHOW';

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffCode" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FunctionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverField" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dataType" "HandoverFieldType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "appliesTo" "HandoverFieldApplies" NOT NULL DEFAULT 'BOTH',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HandoverField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBookingSetting" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "openTime" TEXT NOT NULL DEFAULT '07:00',
    "closeTime" TEXT NOT NULL DEFAULT '17:30',
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 30,
    "minDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 300,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "allowWeekend" BOOLEAN NOT NULL DEFAULT true,
    "checkinWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "minPhotosPerHandover" INTEGER NOT NULL DEFAULT 1,
    "maxPhotosPerHandover" INTEGER NOT NULL DEFAULT 5,
    "photoRetentionMonths" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoomBookingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBooking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "staffCode" TEXT,
    "department" TEXT,
    "reason" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "RoomBookingStatus" NOT NULL DEFAULT 'PENDING',
    "ruleVersionAccepted" INTEGER,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "rejectReason" TEXT,
    "keyReturnedAt" TIMESTAMPTZ(3),
    "keyReturnedById" TEXT,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "adminReviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoomBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'cái',
    "totalQuantity" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBooking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "staffCode" TEXT,
    "department" TEXT,
    "reason" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "RoomBookingStatus" NOT NULL DEFAULT 'PENDING',
    "ruleVersionAccepted" INTEGER,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "rejectReason" TEXT,
    "returnedAt" TIMESTAMPTZ(3),
    "returnedById" TEXT,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "adminReviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EquipmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBookingItem" (
    "id" TEXT NOT NULL,
    "equipmentBookingId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "EquipmentBookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "bookableType" "BookableType" NOT NULL,
    "type" "HandoverType" NOT NULL,
    "roomBookingId" TEXT,
    "equipmentBookingId" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleAccepted" BOOLEAN NOT NULL DEFAULT false,
    "conditionNote" TEXT NOT NULL,
    "fieldValues" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverPhoto" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "capturedAtClient" TIMESTAMPTZ(3),
    "serverReceivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockSkewSeconds" INTEGER,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_staffCode_idx" ON "StaffProfile"("staffCode");

-- CreateIndex
CREATE INDEX "StaffProfile_department_idx" ON "StaffProfile"("department");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionRoom_code_key" ON "FunctionRoom"("code");

-- CreateIndex
CREATE INDEX "FunctionRoom_isActive_sortOrder_idx" ON "FunctionRoom"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FunctionRoom_deletedAt_idx" ON "FunctionRoom"("deletedAt");

-- CreateIndex
CREATE INDEX "RoomRule_roomId_createdAt_idx" ON "RoomRule"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomRule_roomId_version_key" ON "RoomRule"("roomId", "version");

-- CreateIndex
CREATE INDEX "HandoverField_roomId_isActive_sortOrder_idx" ON "HandoverField"("roomId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverField_roomId_key_key" ON "HandoverField"("roomId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBookingSetting_roomId_key" ON "RoomBookingSetting"("roomId");

-- CreateIndex
CREATE INDEX "RoomBooking_roomId_startAt_idx" ON "RoomBooking"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "RoomBooking_userId_startAt_idx" ON "RoomBooking"("userId", "startAt");

-- CreateIndex
CREATE INDEX "RoomBooking_status_idx" ON "RoomBooking"("status");

-- CreateIndex
CREATE INDEX "RoomBooking_department_idx" ON "RoomBooking"("department");

-- CreateIndex
CREATE INDEX "Equipment_roomId_isActive_idx" ON "Equipment"("roomId", "isActive");

-- CreateIndex
CREATE INDEX "Equipment_deletedAt_idx" ON "Equipment"("deletedAt");

-- CreateIndex
CREATE INDEX "EquipmentBooking_roomId_startAt_idx" ON "EquipmentBooking"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "EquipmentBooking_userId_startAt_idx" ON "EquipmentBooking"("userId", "startAt");

-- CreateIndex
CREATE INDEX "EquipmentBooking_status_idx" ON "EquipmentBooking"("status");

-- CreateIndex
CREATE INDEX "EquipmentBookingItem_equipmentId_idx" ON "EquipmentBookingItem"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBookingItem_equipmentBookingId_equipmentId_key" ON "EquipmentBookingItem"("equipmentBookingId", "equipmentId");

-- CreateIndex
CREATE INDEX "Handover_performedById_idx" ON "Handover"("performedById");

-- CreateIndex
CREATE INDEX "Handover_performedAt_idx" ON "Handover"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_roomBookingId_type_key" ON "Handover"("roomBookingId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_equipmentBookingId_type_key" ON "Handover"("equipmentBookingId", "type");

-- CreateIndex
CREATE INDEX "HandoverPhoto_handoverId_idx" ON "HandoverPhoto"("handoverId");

-- CreateIndex
CREATE INDEX "HandoverPhoto_sha256_idx" ON "HandoverPhoto"("sha256");

-- CreateIndex
CREATE INDEX "HandoverPhoto_createdAt_idx" ON "HandoverPhoto"("createdAt");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRule" ADD CONSTRAINT "RoomRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRule" ADD CONSTRAINT "RoomRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverField" ADD CONSTRAINT "HandoverField_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBookingSetting" ADD CONSTRAINT "RoomBookingSetting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_keyReturnedById_fkey" FOREIGN KEY ("keyReturnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "FunctionRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBookingItem" ADD CONSTRAINT "EquipmentBookingItem_equipmentBookingId_fkey" FOREIGN KEY ("equipmentBookingId") REFERENCES "EquipmentBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBookingItem" ADD CONSTRAINT "EquipmentBookingItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_roomBookingId_fkey" FOREIGN KEY ("roomBookingId") REFERENCES "RoomBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_equipmentBookingId_fkey" FOREIGN KEY ("equipmentBookingId") REFERENCES "EquipmentBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverPhoto" ADD CONSTRAINT "HandoverPhoto_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Phần viết tay: những ràng buộc Prisma không khai được trong schema.
-- Sửa schema.prisma rồi chạy lại `migrate dev` sẽ KHÔNG sinh lại các câu dưới
-- đây — nếu tách bảng hay đổi tên cột thì phải bê thủ công sang migration mới.
-- ============================================================

-- btree_gist cho phép trộn toán tử `=` của kiểu vô hướng với toán tử `&&` của
-- kiểu range trong cùng một chỉ mục GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Chống trùng lịch ở tầng CSDL — lớp phòng thủ cuối cùng, đúng một đơn thắng
-- khi hai người đặt cùng slot cùng lúc.
--
-- '[)' = khoảng nửa mở: 9:00-10:00 và 10:00-11:00 KHÔNG bị coi là trùng.
-- Mệnh đề WHERE khiến đơn đã huỷ / bị từ chối / đã trả phòng không còn giữ chỗ,
-- còn đơn PENDING thì VẪN giữ chỗ (tránh việc admin duyệt hai đơn trùng giờ).
ALTER TABLE "RoomBooking"
  ADD CONSTRAINT "RoomBooking_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'APPROVED', 'CHECKED_IN'));

-- Giờ kết thúc phải sau giờ bắt đầu. Không có ràng buộc này thì khoảng rỗng
-- lọt qua được cả EXCLUDE lẫn kiểm tra ở service.
ALTER TABLE "RoomBooking"
  ADD CONSTRAINT "RoomBooking_time_order" CHECK ("startAt" < "endAt");

ALTER TABLE "EquipmentBooking"
  ADD CONSTRAINT "EquipmentBooking_time_order" CHECK ("startAt" < "endAt");

-- Số lượng mượn phải dương.
ALTER TABLE "EquipmentBookingItem"
  ADD CONSTRAINT "EquipmentBookingItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "Equipment"
  ADD CONSTRAINT "Equipment_total_quantity_non_negative" CHECK ("totalQuantity" >= 0);

-- Thay cho khoá ngoại đa hình: một lượt bàn giao gắn vào ĐÚNG MỘT loại đơn, và
-- cột bookableType phải khớp với khoá ngoại thực sự được điền.
ALTER TABLE "Handover"
  ADD CONSTRAINT "Handover_one_bookable" CHECK (
    num_nonnulls("roomBookingId", "equipmentBookingId") = 1
    AND (
      ("bookableType" = 'ROOM' AND "roomBookingId" IS NOT NULL)
      OR ("bookableType" = 'EQUIPMENT' AND "equipmentBookingId" IS NOT NULL)
    )
  );

-- Bản cấu hình mặc định toàn hệ thống (roomId IS NULL) chỉ được có đúng một.
-- @unique của Prisma trên cột nullable không chặn được nhiều dòng NULL.
CREATE UNIQUE INDEX "RoomBookingSetting_global_unique"
  ON "RoomBookingSetting" ((1)) WHERE "roomId" IS NULL;
