import { z } from 'zod';

// ── Enroll/unenroll ────────────────────────────────────────────

export const EnrollUserBodySchema = z.object({
  identifier: z.string().min(1),
  userId: z.string().optional(),
});
export type EnrollUserBody = z.infer<typeof EnrollUserBodySchema>;

export const BulkEnrollBodySchema = z.object({
  identifiers: z.array(z.string().min(1)).min(1),
});
export type BulkEnrollBody = z.infer<typeof BulkEnrollBodySchema>;

export const SelfEnrollBodySchema = z.object({
  code: z.string().min(1),
});
export type SelfEnrollBody = z.infer<typeof SelfEnrollBodySchema>;

export const ResolveUserBodySchema = z.object({
  identifier: z.string().min(1),
});
export type ResolveUserBody = z.infer<typeof ResolveUserBodySchema>;

// ── TA / co-teacher ────────────────────────────────────────────

export const AssignPersonBodySchema = z.object({
  identifier: z.string().min(1),
  userId: z.string().optional(),
});
export type AssignPersonBody = z.infer<typeof AssignPersonBodySchema>;

// ── Response types ─────────────────────────────────────────────

export type UserCompact = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username?: string | null;
  avatar?: string | null;
};

export type CourseMember = {
  id: string;
  userId: string;
  user: UserCompact;
  status: string;
  progress: number;
  enrolledAt: string;
};

export type CourseTA = {
  id: string;
  userId: string;
  user: UserCompact;
  assignedAt: string;
};

export type CourseCoTeacher = {
  id: string;
  userId: string;
  user: UserCompact;
  assignedAt: string;
};

export type CourseMembersResponse = {
  enrollments: CourseMember[];
  tas: CourseTA[];
  coTeachers: CourseCoTeacher[];
};

export type BulkEnrollResult = {
  enrolled: number;
  errors: { identifier: string; reason: string }[];
};

export type UserCandidate = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
};

export type IdentifierLookupResult =
  | { kind: 'found'; user: UserCandidate }
  | { kind: 'multiple'; users: UserCandidate[] }
  | { kind: 'notFound' };
