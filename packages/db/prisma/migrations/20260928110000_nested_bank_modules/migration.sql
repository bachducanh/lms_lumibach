-- Thư mục lồng nhau trong ngân hàng NỘI DUNG của danh mục (Module có
-- bankCategoryId). Chỉ thêm cột — an toàn khi bảng đang có dữ liệu: mọi chương
-- hiện có (của kho lẫn của khoá học) giữ parentId = NULL như trước.

-- AlterTable
ALTER TABLE "Module" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Module_parentId_idx" ON "Module"("parentId");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
