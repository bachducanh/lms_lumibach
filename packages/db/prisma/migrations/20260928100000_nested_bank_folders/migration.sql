-- Thư mục lồng nhau trong ngân hàng câu hỏi của danh mục.
-- Chỉ thêm cột — an toàn khi bảng đang có dữ liệu: mọi thư mục hiện có giữ
-- parentId = NULL, tức là vẫn nằm ở cấp ngoài cùng như trước.

-- AlterTable
ALTER TABLE "QuestionCategory" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "QuestionCategory_parentId_idx" ON "QuestionCategory"("parentId");

-- AddForeignKey
ALTER TABLE "QuestionCategory" ADD CONSTRAINT "QuestionCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "QuestionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
