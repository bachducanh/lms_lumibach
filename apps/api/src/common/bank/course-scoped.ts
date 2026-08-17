import { ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@lumibach/db';
import { canManageCourse } from '../auth/course-access';
import { canManageBankCategory } from './bank-access';

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

/**
 * Chủ sở hữu của một hoạt động: ĐÚNG MỘT trong hai (CHECK ở tầng CSDL giữ điều
 * kiện đó) — một khoá học, hoặc ngân hàng nội dung của một danh mục.
 */
export type ActivityOwner = {
  courseId: string | null;
  bankCategoryId?: string | null;
};

/**
 * "Người này có được sửa hoạt động đó không", cho cả hai kiểu chủ sở hữu.
 *
 * Dùng ở đúng những chỗ NGHIỆP VỤ SOẠN THẢO: sửa đề, thêm/bớt câu hỏi, đổi
 * cấu hình. Các nghiệp vụ gắn với lớp (nộp bài, chấm điểm, bảng điểm, thông báo)
 * KHÔNG dùng hàm này — chúng gọi `assertCourseScoped` để null thành lỗi rõ ràng
 * thay vì lặng lẽ chạy với một bản mẫu không thuộc lớp nào.
 *
 * Không truyền `bankCategoryId` thì hành vi y hệt trước: bản mẫu của ngân hàng
 * bị từ chối, và `canManageCourse` không bao giờ được gọi với courseId null (nó
 * trả true ngay cho ADMIN trước khi nhìn tới courseId).
 */
export async function canManageActivity(
  prisma: PrismaClient,
  user: { id: string; role: string },
  owner: ActivityOwner
): Promise<boolean> {
  if (owner.bankCategoryId) return canManageBankCategory(prisma, user, owner.bankCategoryId);
  if (!owner.courseId) return false;
  return canManageCourse(prisma, user, owner.courseId);
}
