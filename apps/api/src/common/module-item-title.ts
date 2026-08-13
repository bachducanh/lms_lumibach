import type { PrismaClient } from '@lumibach/db';

/** Cột khoá ngoại nối ModuleItem tới nội dung. */
type LinkField =
  | 'lessonId'
  | 'forumId'
  | 'assignmentId'
  | 'quizId'
  | 'codeExerciseId'
  | 'practiceTestId';

/**
 * Đồng bộ tên hoạt động xuống ModuleItem.
 *
 * Tên được lưu ở hai nơi: bản ghi nội dung (Assignment.title, Quiz.title…) và
 * ModuleItem.title — bản sao để dựng cây chương mà không phải join sáu bảng.
 * Đổi tên ở trang chi tiết mà không đồng bộ thì ngoài danh sách chương vẫn hiện
 * tên cũ, đúng như báo cáo của giáo viên.
 *
 * Không làm gì khi `title` là undefined (lần cập nhật không đụng tới tên).
 */
export async function syncModuleItemTitle(
  prisma: PrismaClient,
  field: LinkField,
  id: string,
  title: string | undefined | null
): Promise<void> {
  if (title === undefined || title === null) return;
  await prisma.moduleItem.updateMany({ where: { [field]: id }, data: { title } });
}
