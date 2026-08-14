import { ForbiddenException } from '@nestjs/common';

/**
 * Chốt "bản ghi này phải thuộc một khoá học".
 *
 * Từ khi có ngân hàng nội dung gắn vào danh mục, `courseId` của Module và của
 * các hoạt động có thể null — bản ghi đó thuộc ngân hàng, không thuộc lớp nào.
 * Mọi nghiệp vụ gắn với lớp (đăng bài, nộp bài, chấm điểm, bảng điểm, thông báo,
 * kiểm quyền qua khoá học) đều vô nghĩa với bản mẫu trong ngân hàng.
 *
 * Nguy hiểm nhất là kiểm quyền: `canManageCourse` trả `true` ngay cho ADMIN
 * TRƯỚC khi nhìn tới courseId, nên một `courseId` null lọt vào đó sẽ đi thẳng
 * qua cửa. Gọi hàm này ngay sau khi đọc bản ghi thì null thành lỗi rõ ràng chứ
 * không thành lỗ hổng.
 */
export function assertCourseScoped(
  courseId: string | null | undefined,
  what = 'Nội dung này'
): string {
  if (!courseId) {
    throw new ForbiddenException(
      `${what} thuộc ngân hàng của danh mục, không thuộc khoá học nào — thao tác này chỉ dùng cho nội dung của khoá học.`
    );
  }
  return courseId;
}

/**
 * Điều kiện Prisma "chỉ lấy bản ghi của khoá học".
 *
 * Dùng cho các truy vấn liệt kê không đi qua một khoá cụ thể (thùng rác, dọn
 * rác, thống kê). Thiếu nó thì bản mẫu của ngân hàng lọt vào danh sách của lớp.
 */
export const ONLY_COURSE_SCOPED = { courseId: { not: null } } as const;
