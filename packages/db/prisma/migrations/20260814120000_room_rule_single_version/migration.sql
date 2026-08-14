-- Nội quy phòng: bỏ đánh số bản, mỗi phòng còn ĐÚNG MỘT bản, sửa là ghi đè.
--
-- CÓ MẤT DỮ LIỆU — cố ý. Migration này xoá các bản nội quy cũ và bỏ luôn cột
-- ghi "đơn này chấp nhận bản số mấy". Sao lưu CSDL trước khi chạy trên máy chủ,
-- xem mục "Sao lưu" trong docs/HANDOVER.md. Không có đường lùi.

-- 1. Mỗi phòng chỉ giữ lại bản mới nhất. So bằng `version` chứ không bằng
--    `createdAt`: hai bản tạo trong cùng một mili giây thì createdAt bằng nhau,
--    còn version thì luôn khác — @@unique([roomId, version]) bảo đảm điều đó.
DELETE FROM "RoomRule" a
USING "RoomRule" b
WHERE a."roomId" = b."roomId"
  AND a."version" < b."version";

-- 2. Bỏ ràng buộc và chỉ mục gắn với version.
DROP INDEX IF EXISTS "RoomRule_roomId_version_key";
DROP INDEX IF EXISTS "RoomRule_roomId_createdAt_idx";

ALTER TABLE "RoomRule" DROP COLUMN "version";

-- 3. Một phòng một bản.
CREATE UNIQUE INDEX "RoomRule_roomId_key" ON "RoomRule"("roomId");

-- 4. Thêm updatedAt. Thêm cho phép NULL rồi mới lấp và siết NOT NULL — cột
--    NOT NULL không mặc định mà thêm thẳng vào bảng đang có dữ liệu là lỗi.
--    Lấp bằng createdAt của chính bản đang giữ: đó đúng là lần sửa gần nhất.
ALTER TABLE "RoomRule" ADD COLUMN "updatedAt" TIMESTAMPTZ(3);
UPDATE "RoomRule" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "RoomRule" ALTER COLUMN "updatedAt" SET NOT NULL;

-- 5. Đơn không còn chốt phiên bản nữa — nội quy hiển thị luôn là bản hiện hành.
--    `Handover.ruleAccepted` vẫn giữ, nên vẫn biết người mượn CÓ tích xác nhận
--    hay không, chỉ không tra ngược được nội dung lúc đó.
ALTER TABLE "RoomBooking" DROP COLUMN "ruleVersionAccepted";
ALTER TABLE "EquipmentBooking" DROP COLUMN "ruleVersionAccepted";
