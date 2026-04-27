import type { UserRole } from '@prisma/client';

// Thứ bậc role: số cao hơn = quyền rộng hơn
const ROLE_RANK: Record<UserRole, number> = {
  STUDENT: 1,
  TA: 2,
  TEACHER: 3,
  ADMIN: 4,
};

/** User có ít nhất role yêu cầu không? */
export function hasMinRole(userRole: UserRole | undefined, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

/** Throw nếu user không có đủ role */
export function requireRole(userRole: UserRole | undefined, ...roles: UserRole[]): void {
  if (!userRole || !roles.includes(userRole)) {
    throw new Error('UNAUTHORIZED');
  }
}

/** Có phải admin không */
export const isAdmin = (role?: UserRole) => role === 'ADMIN';

/** Có thể quản lý nội dung (admin, teacher) */
export const canManageContent = (role?: UserRole) =>
  !!role && hasMinRole(role, 'TEACHER');

/** Có thể chấm bài (admin, teacher, TA) */
export const canGrade = (role?: UserRole) =>
  !!role && hasMinRole(role, 'TA');

/** Có thể xem tất cả submission trong khóa */
export const canViewAllSubmissions = (role?: UserRole) =>
  !!role && hasMinRole(role, 'TA');
