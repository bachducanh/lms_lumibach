import { beforeEach, describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCourse, createTestUser } from '../factories';
import { CoursesService } from '@/modules/courses/courses.service';
import { resolveCourseAccess } from '@/common/auth/course-access';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Chuyển quyền chủ khoá học. ADMIN tạo khoá nên mặc định là chủ, nhưng thẻ khoá
 * học hiện tên chủ khoá — nên phải trao được cho giáo viên thật sự dạy lớp.
 */

const asUser = (u: { id: string; role: string }) => ({ id: u.id, role: u.role }) as AuthUser;

const noopCache = { del: async () => undefined } as unknown as Cache;

function makeService() {
  // transferOwnership chỉ dùng prisma, cache và audit — các phụ thuộc còn lại
  // của CoursesService không bị chạm tới.
  return new CoursesService(
    testPrisma,
    noopCache,
    { log: () => undefined } as never,
    {} as never,
    {} as never,
    {} as never
  );
}

async function setup() {
  const admin = await createTestUser({ role: 'ADMIN' });
  const teacher = await createTestUser({ role: 'TEACHER', fullName: 'Lê Thị Hồng Ngát' });
  const course = await createTestCourse({ ownerId: admin.id, status: 'PUBLISHED' });
  await testPrisma.courseCoTeacher.create({ data: { userId: teacher.id, courseId: course.id } });
  return { admin, teacher, course };
}

describe('Chuyển quyền chủ khoá học', () => {
  let service: CoursesService;

  beforeEach(() => {
    service = makeService();
  });

  it('admin trao cho giáo viên đồng giảng: giáo viên thành chủ, admin không bị thêm vào danh sách', async () => {
    const { admin, teacher, course } = await setup();

    const res = await service.transferOwnership(asUser(admin), course.id, teacher.id);
    expect(res.message).toContain('Lê Thị Hồng Ngát');

    const after = await testPrisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after.ownerId).toBe(teacher.id);

    const coTeachers = await testPrisma.courseCoTeacher.findMany({
      where: { courseId: course.id },
    });
    expect(coTeachers).toHaveLength(0);

    // Giáo viên có đủ quyền chủ khoá; admin vẫn toàn quyền.
    expect(await resolveCourseAccess(testPrisma, asUser(teacher), course.id)).toEqual({
      canManage: true,
      canGrade: true,
      isOwner: true,
    });
    expect((await resolveCourseAccess(testPrisma, asUser(admin), course.id)).isOwner).toBe(true);
  });

  it('chủ khoá là giáo viên chuyển tiếp thì được giữ lại làm đồng giảng', async () => {
    const { admin, teacher, course } = await setup();
    await service.transferOwnership(asUser(admin), course.id, teacher.id);

    const other = await createTestUser({ role: 'TEACHER' });
    await service.transferOwnership(asUser(teacher), course.id, other.id);

    const after = await testPrisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after.ownerId).toBe(other.id);
    const access = await resolveCourseAccess(testPrisma, asUser(teacher), course.id);
    expect(access).toEqual({ canManage: true, canGrade: true, isOwner: false });
  });

  it('đồng giảng không tự nhận quyền chủ; không chuyển cho học sinh hay tài khoản bị khoá', async () => {
    const { admin, teacher, course } = await setup();

    await expect(service.transferOwnership(asUser(teacher), course.id, teacher.id)).rejects.toThrow(
      'Chỉ admin hoặc chủ khoá học'
    );

    const student = await createTestUser({ role: 'STUDENT' });
    await expect(service.transferOwnership(asUser(admin), course.id, student.id)).rejects.toThrow(
      'tài khoản Giáo viên'
    );

    const locked = await createTestUser({ role: 'TEACHER', status: 'SUSPENDED' });
    await expect(service.transferOwnership(asUser(admin), course.id, locked.id)).rejects.toThrow(
      'chưa hoạt động'
    );

    await expect(service.transferOwnership(asUser(admin), course.id, admin.id)).rejects.toThrow(
      'đã là chủ khoá học'
    );

    const after = await testPrisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after.ownerId).toBe(admin.id);
  });
});
