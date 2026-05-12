import type { UserRole, UserStatus, CourseStatus } from '@lumibach/db';
import { testPrisma } from './db';

/**
 * Factory helpers — create persisted DB rows với sensible defaults.
 *
 * Mỗi factory generate unique id qua counter để tránh duplicate khi nhiều
 * test create user trong cùng 1 file (truncate ở beforeEach reset state
 * nhưng counter trong process vẫn tăng — đủ unique cho tests).
 */

let counter = 0;
const uniq = () => `${Date.now()}-${++counter}`;

export type CreateUserInput = {
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  firstName?: string;
  lastName?: string;
  fullName?: string;
};

export async function createTestUser(input: CreateUserInput = {}) {
  const stamp = uniq();
  return testPrisma.user.create({
    data: {
      email: input.email ?? `test-${stamp}@example.com`,
      passwordHash: '$2a$10$test.hash.not.real.for.testing.only.placeholder',
      firstName: input.firstName ?? 'Test',
      lastName: input.lastName ?? `User${stamp}`,
      fullName: input.fullName ?? `Test User${stamp}`,
      role: input.role ?? 'STUDENT',
      // ACTIVE để pass NextAuthGuard; test specific status overrides nếu cần.
      status: input.status ?? 'ACTIVE',
    },
  });
}

export type CreateCourseInput = {
  ownerId: string;
  name?: string;
  slug?: string;
  status?: CourseStatus;
};

export async function createTestCourse(input: CreateCourseInput) {
  const stamp = uniq();
  return testPrisma.course.create({
    data: {
      name: input.name ?? `Test Course ${stamp}`,
      slug: input.slug ?? `test-course-${stamp}`,
      status: input.status ?? 'DRAFT',
      ownerId: input.ownerId,
    },
  });
}

export type CreateEnrollmentInput = {
  userId: string;
  courseId: string;
};

export async function createTestEnrollment(input: CreateEnrollmentInput) {
  return testPrisma.enrollment.create({
    data: {
      userId: input.userId,
      courseId: input.courseId,
      status: 'ACTIVE',
    },
  });
}
