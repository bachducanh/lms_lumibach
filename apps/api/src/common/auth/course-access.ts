import type { PrismaClient } from '@lumibach/db';

/**
 * Quyền của một người dùng đối với MỘT khoá học cụ thể.
 *
 * - canManage: tạo/sửa/xoá nội dung khoá (bài giảng, quiz, câu hỏi, năng lực…).
 *   ADMIN, owner và co-teacher đều có. TA thì KHÔNG.
 * - canGrade: chấm bài, xem bảng điểm/báo cáo/năng lực toàn khoá.
 *   ADMIN, owner, co-teacher và TA đều có.
 */
export type CourseAccess = {
  canManage: boolean;
  canGrade: boolean;
  /** ADMIN hoặc chủ khoá thật sự (KHÔNG gồm co-teacher). Dùng cho thao tác cấp
   *  khoá: sửa/xoá khoá, mã ghi danh, quản lý thành viên & nhân sự. */
  isOwner: boolean;
};

const NONE: CourseAccess = { canManage: false, canGrade: false, isOwner: false };

/**
 * Phân giải quyền của user trên khoá học theo ma trận thống nhất:
 *   ADMIN          → manage + grade
 *   Owner (chủ)    → manage + grade
 *   Co-teacher     → manage + grade
 *   TA được phân   → grade
 *   Khác           → không có quyền
 *
 * Thay cho các check `ownerId === userId` rời rạc (chỉ owner) trước đây, vốn
 * vô tình chặn co-teacher khỏi mọi thao tác quản lý nội dung khoá học.
 */
export async function resolveCourseAccess(
  prisma: PrismaClient,
  user: { id: string; role: string },
  courseId: string
): Promise<CourseAccess> {
  if (user.role === 'ADMIN') return { canManage: true, canGrade: true, isOwner: true };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { ownerId: true },
  });
  if (!course) return NONE;

  if (user.role === 'TEACHER' && course.ownerId === user.id) {
    return { canManage: true, canGrade: true, isOwner: true };
  }

  const coTeacher = await prisma.courseCoTeacher.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (coTeacher) return { canManage: true, canGrade: true, isOwner: false };

  const ta = await prisma.teachingAssistant.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (ta) return { canManage: false, canGrade: true, isOwner: false };

  return NONE;
}

/** Tiện ích: chỉ cần biết có quyền quản lý nội dung hay không. */
export async function canManageCourse(
  prisma: PrismaClient,
  user: { id: string; role: string },
  courseId: string
): Promise<boolean> {
  return (await resolveCourseAccess(prisma, user, courseId)).canManage;
}
