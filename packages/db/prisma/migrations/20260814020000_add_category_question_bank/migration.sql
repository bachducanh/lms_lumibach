-- Ngân hàng câu hỏi gắn thẳng vào danh mục khoá học.
--
-- Trước đây "ngân hàng chung" chỉ là khung nhìn ảo: câu hỏi luôn thuộc một khoá,
-- cờ sharedToCategory chỉ khiến khoá khác cùng nhánh NHÌN THẤY nó. Không có chỗ
-- nào để soạn nội dung dùng chung mà không phải mượn tạm một khoá học.
--
-- Từ đây, QuestionCategory và Question thuộc về ĐÚNG MỘT chủ sở hữu:
--   courseId       — kho riêng của một khoá học (dữ liệu cũ đều nằm ở nhánh này)
--   bankCategoryId — ngân hàng chung của một danh mục khoá học
--
-- Ràng buộc "đúng một" cài bằng CHECK chứ không chỉ dựa vào tầng ứng dụng: hai
-- cột cùng null thì bản ghi thành mồ côi không ai dọn, còn cùng có giá trị thì
-- không xác định được nó thuộc về đâu khi chép hoặc khi xoá khoá.

-- ── QuestionCategory ────────────────────────────────────────────────────────
ALTER TABLE "QuestionCategory" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "QuestionCategory" ADD COLUMN "bankCategoryId" TEXT;

CREATE INDEX "QuestionCategory_bankCategoryId_idx" ON "QuestionCategory"("bankCategoryId");

ALTER TABLE "QuestionCategory"
  ADD CONSTRAINT "QuestionCategory_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionCategory"
  ADD CONSTRAINT "QuestionCategory_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

-- ── Question ────────────────────────────────────────────────────────────────
ALTER TABLE "Question" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Question" ADD COLUMN "bankCategoryId" TEXT;

CREATE INDEX "Question_bankCategoryId_idx" ON "Question"("bankCategoryId");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));
