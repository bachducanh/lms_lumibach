-- Ghi người tạo cho thư mục trong ngân hàng của danh mục.
--
-- Câu hỏi trong kho đã có quy tắc "giáo viên chỉ sửa/xoá thứ chính mình thêm
-- vào"; thư mục thì chưa, nên bất kỳ ai quản lý danh mục cũng đổi tên hoặc xoá
-- được thư mục của người khác. Xoá thư mục không làm mất câu hỏi, nhưng mất
-- cách sắp xếp của người khác thì vẫn là mất việc đã làm.
--
-- Để NULL cho thư mục của khoá học: ở đó mọi người quản lý khoá đều sắp xếp
-- được từ trước tới nay, siết thêm sẽ đổi hành vi đang dùng mà không ai yêu cầu.
ALTER TABLE "QuestionCategory" ADD COLUMN "createdBy" TEXT;
