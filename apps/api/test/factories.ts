import type { UserRole, UserStatus, CourseStatus, RoomBookingStatus } from '@lumibach/db';
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

export type CreateCategoryInput = {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
};

export async function createTestCategory(input: CreateCategoryInput = {}) {
  const stamp = uniq();
  const name = input.name ?? `Test Category ${stamp}`;
  return testPrisma.courseCategory.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + stamp,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export type CreateCourseInput = {
  ownerId: string;
  name?: string;
  slug?: string;
  status?: CourseStatus;
  categoryId?: string;
};

export async function createTestCourse(input: CreateCourseInput) {
  const stamp = uniq();
  // Auto-create a leaf category if caller doesn't supply one — courses now
  // require categoryId since the categories module landed.
  const categoryId =
    input.categoryId ?? (await createTestCategory({ name: `Auto Cat ${stamp}` })).id;
  return testPrisma.course.create({
    data: {
      name: input.name ?? `Test Course ${stamp}`,
      slug: input.slug ?? `test-course-${stamp}`,
      status: input.status ?? 'DRAFT',
      ownerId: input.ownerId,
      categoryId,
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

// ── Phòng chức năng ────────────────────────────────────────────

export type CreateRoomInput = {
  name?: string;
  code?: string;
  isActive?: boolean;
  sortOrder?: number;
  capacity?: number | null;
  location?: string | null;
};

export async function createTestRoom(input: CreateRoomInput = {}) {
  const stamp = uniq();
  return testPrisma.functionRoom.create({
    data: {
      name: input.name ?? `Phòng test ${stamp}`,
      code: input.code ?? `phong-test-${stamp}`,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      capacity: input.capacity ?? 30,
      location: input.location ?? 'Tầng 2',
    },
  });
}

export type CreateRoomBookingInput = {
  roomId: string;
  userId: string;
  startAt: Date;
  endAt: Date;
  status?: RoomBookingStatus;
  department?: string | null;
};

export async function createTestRoomBooking(input: CreateRoomBookingInput) {
  return testPrisma.roomBooking.create({
    data: {
      roomId: input.roomId,
      userId: input.userId,
      fullName: 'Giáo viên Test',
      department: input.department ?? 'Tổ Toán - Tin',
      reason: 'Dạy thực hành',
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status ?? 'PENDING',
    },
  });
}

export type CreateRoomRuleInput = {
  roomId: string;
  updatedById: string;
  version: number;
  content?: string;
};

export async function createTestRoomRule(input: CreateRoomRuleInput) {
  return testPrisma.roomRule.create({
    data: {
      roomId: input.roomId,
      updatedById: input.updatedById,
      version: input.version,
      content: input.content ?? `<p>Nội quy bản ${input.version}</p>`,
    },
  });
}
