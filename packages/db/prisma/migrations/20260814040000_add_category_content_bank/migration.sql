-- Ngân hàng NỘI DUNG gắn thẳng vào danh mục khoá học (đợt 2, nối tiếp
-- add_category_question_bank đã làm cho câu hỏi).
--
-- Chương (Module) và 5 loại hoạt động giờ thuộc về ĐÚNG MỘT chủ sở hữu:
--   courseId       — của một khoá học (mọi dữ liệu cũ đều ở nhánh này)
--   bankCategoryId — của ngân hàng nội dung thuộc một danh mục khoá học
--
-- Lesson KHÔNG cần cột nào: nó vốn không có courseId, chỉ treo vào ModuleItem.
-- ModuleItem cũng vậy — nó thuộc Module, nên chương nằm ở đâu thì hoạt động
-- nằm ở đó.
--
-- Bản trong ngân hàng là BẢN MẪU: không đăng, không có bài nộp / lượt làm bài,
-- không vào bảng điểm. Nhờ vậy mọi truy vấn cũ lọc theo courseId vẫn đúng —
-- chúng đơn giản là không khớp bản ghi nào của ngân hàng.

-- ── Module ──────────────────────────────────────────────────────────────────
ALTER TABLE "Module" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Module" ADD COLUMN "bankCategoryId" TEXT;
-- Chỉ ghi cho chương của ngân hàng: giáo viên chỉ sửa/xoá được thứ mình tạo.
ALTER TABLE "Module" ADD COLUMN "createdBy" TEXT;

CREATE INDEX "Module_bankCategoryId_idx" ON "Module"("bankCategoryId");

ALTER TABLE "Module"
  ADD CONSTRAINT "Module_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Module"
  ADD CONSTRAINT "Module_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

-- ── Assignment / Quiz / CodeExercise / PracticeTest / Forum ─────────────────
ALTER TABLE "Assignment" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Assignment" ADD COLUMN "bankCategoryId" TEXT;
CREATE INDEX "Assignment_bankCategoryId_idx" ON "Assignment"("bankCategoryId");
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

ALTER TABLE "Quiz" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Quiz" ADD COLUMN "bankCategoryId" TEXT;
CREATE INDEX "Quiz_bankCategoryId_idx" ON "Quiz"("bankCategoryId");
ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

ALTER TABLE "CodeExercise" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "CodeExercise" ADD COLUMN "bankCategoryId" TEXT;
CREATE INDEX "CodeExercise_bankCategoryId_idx" ON "CodeExercise"("bankCategoryId");
ALTER TABLE "CodeExercise"
  ADD CONSTRAINT "CodeExercise_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeExercise"
  ADD CONSTRAINT "CodeExercise_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

ALTER TABLE "PracticeTest" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "PracticeTest" ADD COLUMN "bankCategoryId" TEXT;
CREATE INDEX "PracticeTest_bankCategoryId_idx" ON "PracticeTest"("bankCategoryId");
ALTER TABLE "PracticeTest"
  ADD CONSTRAINT "PracticeTest_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeTest"
  ADD CONSTRAINT "PracticeTest_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));

ALTER TABLE "Forum" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "Forum" ADD COLUMN "bankCategoryId" TEXT;
CREATE INDEX "Forum_bankCategoryId_idx" ON "Forum"("bankCategoryId");
ALTER TABLE "Forum"
  ADD CONSTRAINT "Forum_bankCategoryId_fkey"
  FOREIGN KEY ("bankCategoryId") REFERENCES "CourseCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Forum"
  ADD CONSTRAINT "Forum_owner_exactly_one"
  CHECK (("courseId" IS NOT NULL) <> ("bankCategoryId" IS NOT NULL));
