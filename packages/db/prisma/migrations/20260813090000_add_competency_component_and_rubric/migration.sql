-- CreateTable: thành phần năng lực (tầng mới giữa Danh mục và Chỉ báo, theo
-- format chấm điểm mới "26-27 MIT S3" — cấp độ xuất phát/đích và điểm năng
-- lực được chấm ở cấp thành phần rồi mới gộp lên danh mục).
CREATE TABLE "CompetencyComponent" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyComponent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetencyComponent_categoryId_idx" ON "CompetencyComponent"("categoryId");

ALTER TABLE "CompetencyComponent" ADD CONSTRAINT "CompetencyComponent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetencyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: tạo 1 thành phần mặc định cho mỗi danh mục đang có (trùng tên
-- danh mục), để không mất chỉ báo / mục tiêu đã nhập trước đây. GV tự tách
-- thành các thành phần thật (vd MATH.1.1, MATH.1.2...) qua UI sau khi triển
-- khai — đây là phần việc tăng thêm đã được xác nhận trước.
INSERT INTO "CompetencyComponent" ("id", "categoryId", "name", "position", "createdAt", "updatedAt")
SELECT 'cmpd' || substr(md5(random()::text || clock_timestamp()::text || cc."id"), 1, 21), cc."id", cc."name", 0, now(), now()
FROM "CompetencyCategory" cc;

-- AlterTable: CompetencyIndicator — chuyển từ thuộc trực tiếp danh mục sang
-- thuộc thành phần. Thêm cột nullable trước, backfill xong mới NOT NULL.
ALTER TABLE "CompetencyIndicator" ADD COLUMN "componentId" TEXT;

UPDATE "CompetencyIndicator" i
SET "componentId" = comp."id"
FROM "CompetencyComponent" comp
WHERE comp."categoryId" = i."categoryId";

ALTER TABLE "CompetencyIndicator" ALTER COLUMN "componentId" SET NOT NULL;

ALTER TABLE "CompetencyIndicator" DROP CONSTRAINT "CompetencyIndicator_categoryId_fkey";
DROP INDEX "CompetencyIndicator_categoryId_idx";
ALTER TABLE "CompetencyIndicator" DROP COLUMN "categoryId";

CREATE INDEX "CompetencyIndicator_componentId_idx" ON "CompetencyIndicator"("componentId");
ALTER TABLE "CompetencyIndicator" ADD CONSTRAINT "CompetencyIndicator_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CompetencyComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: CompetencyLevelTarget — cấp độ xuất phát/đích giờ chấm theo
-- thành phần. Giữ lại categoryId (denormalized) để lọc/tổng hợp theo danh
-- mục mà không phải join qua component ở mọi câu truy vấn.
ALTER TABLE "CompetencyLevelTarget" ADD COLUMN "componentId" TEXT;

UPDATE "CompetencyLevelTarget" t
SET "componentId" = comp."id"
FROM "CompetencyComponent" comp
WHERE comp."categoryId" = t."categoryId";

ALTER TABLE "CompetencyLevelTarget" ALTER COLUMN "componentId" SET NOT NULL;

DROP INDEX "CompetencyLevelTarget_periodId_categoryId_studentId_key";
CREATE UNIQUE INDEX "CompetencyLevelTarget_periodId_componentId_studentId_key" ON "CompetencyLevelTarget"("periodId", "componentId", "studentId");
CREATE INDEX "CompetencyLevelTarget_componentId_idx" ON "CompetencyLevelTarget"("componentId");
ALTER TABLE "CompetencyLevelTarget" ADD CONSTRAINT "CompetencyLevelTarget_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CompetencyComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: ActivityCompetency — rubric 5 mức riêng theo cặp (chỉ báo,
-- hoạt động), vì cùng 1 chỉ báo có thể được đánh giá bằng rubric khác nhau
-- tuỳ hoạt động/bài cụ thể (đã xác nhận với người dùng đây là tình huống
-- thực tế đang gặp khi vận hành).
ALTER TABLE "ActivityCompetency" ADD COLUMN     "rubricAdvanced" TEXT,
ADD COLUMN     "rubricApproaching" TEXT,
ADD COLUMN     "rubricBeginning" TEXT,
ADD COLUMN     "rubricNoEvidence" TEXT,
ADD COLUMN     "rubricProficient" TEXT;
