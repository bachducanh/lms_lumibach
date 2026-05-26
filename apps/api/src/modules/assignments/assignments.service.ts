import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function logActivity(
  prisma: PrismaClient,
  params: {
    userId: string;
    courseId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
  }
) {
  prisma.activityLog
    .create({ data: params as Parameters<typeof prisma.activityLog.create>[0]['data'] })
    .catch(() => {});
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  private async invalidateModuleCache(courseId: string): Promise<void> {
    await Promise.allSettled([
      this.cache.del(`modules:${courseId}`),
      this.cache.del(`modules:pub:${courseId}`),
      this.cache.del(`modules:nav:${courseId}`),
      this.cache.del(`modules:nav:pub:${courseId}`),
    ]);
  }

  private async canManage(userId: string, role: string, courseId: string) {
    if (role === 'ADMIN') return true;
    if (role !== 'TEACHER') return false;
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    return c?.ownerId === userId;
  }

  // Validate the file list a student submits. Files are uploaded separately via the
  // Next.js upload route; here we only trust metadata that points back into our own
  // storage (relative /storage/… URL) to block javascript: hrefs / external links.
  private sanitizeSubmissionFiles(
    input: { name: string; url: string; mimeType: string; size: number }[] | undefined,
    maxFiles: number | null
  ): { name: string; url: string; mimeType: string; size: number }[] {
    const files = Array.isArray(input) ? input : [];
    if (files.length === 0) return [];

    const HARD_CAP = 30;
    const limit = maxFiles && maxFiles > 0 ? Math.min(maxFiles, HARD_CAP) : HARD_CAP;
    if (files.length > limit) throw new ForbiddenException(`Chỉ được nộp tối đa ${limit} file.`);

    return files.map((f) => {
      if (!f || typeof f.url !== 'string' || !f.url.startsWith('/storage/'))
        throw new ForbiddenException('File không hợp lệ.');
      const name =
        typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 255) : 'file';
      const mimeType =
        typeof f.mimeType === 'string' && f.mimeType
          ? f.mimeType.slice(0, 150)
          : 'application/octet-stream';
      const size = Number.isFinite(f.size) && f.size >= 0 ? Math.floor(f.size) : 0;
      return { name, url: f.url, mimeType, size };
    });
  }

  // ── List (grouped by module) ─────────────────────────────────

  async listByModule(user: AuthUser, courseId: string) {
    const isStaff = hasMinRole(user.role, 'TA');
    const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

    const modules = await this.prisma.module.findMany({
      where: { courseId, ...(isStaff ? {} : { isPublished: true }) },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        items: {
          where: { type: 'ASSIGNMENT', ...(isStaff ? {} : { isPublished: true }) },
          orderBy: { position: 'asc' },
          select: { assignmentId: true },
        },
      },
    });

    const allAssignments = await this.prisma.assignment.findMany({
      where: { courseId, deletedAt: null, ...statusFilter },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        maxScore: true,
        dueDate: true,
        availableFrom: true,
        allowResubmit: true,
        latePolicy: true,
        _count: { select: { submissions: true } },
      },
    });

    const aMap = new Map(allAssignments.map((a) => [a.id, a]));
    const linkedIds = new Set<string>();
    const groups = [];

    for (const mod of modules) {
      const modAssignments = [];
      for (const item of mod.items) {
        if (item.assignmentId && aMap.has(item.assignmentId)) {
          modAssignments.push(aMap.get(item.assignmentId)!);
          linkedIds.add(item.assignmentId);
        }
      }
      if (modAssignments.length > 0) {
        groups.push({
          moduleId: mod.id,
          moduleName: mod.name,
          position: mod.position,
          assignments: modAssignments,
        });
      }
    }

    const standalone = isStaff ? allAssignments.filter((a) => !linkedIds.has(a.id)) : [];
    return { groups, standalone };
  }

  // ── Get single ────────────────────────────────────────────────

  async getById(id: string) {
    const a = await this.prisma.assignment.findUnique({
      where: { id, deletedAt: null },
      include: {
        moduleItems: {
          select: { id: true, moduleId: true, module: { select: { name: true } } },
        },
        _count: { select: { submissions: true } },
      },
    });
    if (!a) throw new NotFoundException('Không tìm thấy bài tập.');
    return a;
  }

  // ── Create ────────────────────────────────────────────────────

  async create(
    user: AuthUser,
    body: {
      courseId: string;
      title: string;
      instructions?: string;
      type?: string;
      maxScore?: number;
      weight?: number;
      availableFrom?: string | null;
      dueDate?: string | null;
      lateDeadline?: string | null;
      latePolicy?: string;
      latePenalty?: number | null;
      allowResubmit?: boolean;
      maxAttempts?: number | null;
      maxFileSizeMb?: number | null;
      maxFiles?: number | null;
      moduleId?: string | null;
      publish?: boolean;
    }
  ) {
    if (!(await this.canManage(user.id, user.role, body.courseId)))
      throw new ForbiddenException('Không có quyền.');

    const { moduleId, publish, courseId, ...data } = body;

    const assignment = await this.prisma.$transaction(async (tx) => {
      const a = await tx.assignment.create({
        data: {
          courseId,
          title: data.title,
          instructions: data.instructions ?? '',
          type: (data.type ?? 'TEXT') as 'TEXT' | 'FILE' | 'BOTH',
          status: publish ? 'PUBLISHED' : 'DRAFT',
          maxScore: data.maxScore ?? 100,
          weight: data.weight ?? 1,
          availableFrom: toDate(data.availableFrom),
          dueDate: toDate(data.dueDate),
          lateDeadline: toDate(data.lateDeadline),
          latePolicy: (data.latePolicy ?? 'NONE') as 'NONE' | 'ALLOW' | 'DEDUCT',
          latePenalty: data.latePenalty ?? null,
          allowResubmit: data.allowResubmit ?? false,
          maxAttempts: data.maxAttempts ?? null,
          maxFileSizeMb: data.maxFileSizeMb ?? null,
          maxFiles: data.maxFiles ?? null,
          createdBy: user.id,
          publishedAt: publish ? new Date() : null,
        },
      });

      if (moduleId) {
        const last = await tx.moduleItem.findFirst({
          where: { moduleId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        await tx.moduleItem.create({
          data: {
            moduleId,
            type: 'ASSIGNMENT',
            position: (last?.position ?? -1) + 1,
            title: a.title,
            assignmentId: a.id,
          },
        });
      }

      return a;
    });

    if (moduleId) await this.invalidateModuleCache(courseId);
    return { assignmentId: assignment.id };
  }

  // ── Update ────────────────────────────────────────────────────

  async update(
    user: AuthUser,
    id: string,
    body: {
      title?: string;
      instructions?: string;
      type?: string;
      maxScore?: number;
      weight?: number;
      availableFrom?: string | null;
      dueDate?: string | null;
      lateDeadline?: string | null;
      latePolicy?: string;
      latePenalty?: number | null;
      allowResubmit?: boolean;
      maxAttempts?: number | null;
      maxFileSizeMb?: number | null;
      maxFiles?: number | null;
      groupSubmission?: boolean;
      groupingId?: string | null;
      publish?: boolean;
    }
  ) {
    const existing = await this.prisma.assignment.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    // Validate grouping thuộc đúng khoá học nếu được đặt.
    if (body.groupingId) {
      const grouping = await this.prisma.grouping.findFirst({
        where: { id: body.groupingId, courseId: existing.courseId },
        select: { id: true },
      });
      if (!grouping) throw new ForbiddenException('Phân nhóm không thuộc khoá học.');
    }

    let newStatus = existing.status;
    if (body.publish === true) newStatus = 'PUBLISHED';
    if (body.publish === false) newStatus = 'DRAFT';

    await this.prisma.assignment.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.instructions !== undefined && { instructions: body.instructions }),
        ...(body.type !== undefined && { type: body.type as 'TEXT' | 'FILE' | 'BOTH' }),
        status: newStatus,
        ...(body.maxScore !== undefined && { maxScore: body.maxScore }),
        ...(body.weight !== undefined && { weight: body.weight }),
        ...(body.availableFrom !== undefined && { availableFrom: toDate(body.availableFrom) }),
        ...(body.dueDate !== undefined && { dueDate: toDate(body.dueDate) }),
        ...(body.lateDeadline !== undefined && { lateDeadline: toDate(body.lateDeadline) }),
        ...(body.latePolicy !== undefined && {
          latePolicy: body.latePolicy as 'NONE' | 'ALLOW' | 'DEDUCT',
        }),
        ...(body.latePenalty !== undefined && { latePenalty: body.latePenalty }),
        ...(body.allowResubmit !== undefined && { allowResubmit: body.allowResubmit }),
        ...(body.maxAttempts !== undefined && { maxAttempts: body.maxAttempts }),
        ...(body.maxFileSizeMb !== undefined && { maxFileSizeMb: body.maxFileSizeMb }),
        ...(body.maxFiles !== undefined && { maxFiles: body.maxFiles }),
        ...(body.groupSubmission !== undefined && { groupSubmission: body.groupSubmission }),
        ...(body.groupingId !== undefined && { groupingId: body.groupingId }),
        publishedAt:
          newStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : undefined,
      },
    });

    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã cập nhật bài tập.' };
  }

  // ── Delete ────────────────────────────────────────────────────

  async delete(user: AuthUser, id: string) {
    const existing = await this.prisma.assignment.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.assignment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã xóa bài tập.' };
  }

  // ── Submissions ───────────────────────────────────────────────

  async getMySubmissions(user: AuthUser, assignmentId: string) {
    return this.prisma.submission.findMany({
      where: { assignmentId, studentId: user.id },
      orderBy: { attemptNumber: 'desc' },
      include: {
        files: { select: { id: true, name: true, url: true, size: true, mimeType: true } },
      },
    });
  }

  async getAllSubmissions(user: AuthUser, assignmentId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const all = await this.prisma.submission.findMany({
      where: { assignmentId },
      orderBy: [{ studentId: 'asc' }, { attemptNumber: 'desc' }],
      include: {
        files: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
        student: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    const seen = new Set<string>();
    return all.filter((s) => {
      if (seen.has(s.studentId)) return false;
      seen.add(s.studentId);
      return true;
    });
  }

  async submitAssignment(
    user: AuthUser,
    assignmentId: string,
    body: {
      content: string;
      asDraft?: boolean;
      files?: { name: string; url: string; mimeType: string; size: number }[];
    }
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId, deletedAt: null },
      select: {
        courseId: true,
        title: true,
        status: true,
        type: true,
        dueDate: true,
        lateDeadline: true,
        latePolicy: true,
        maxFiles: true,
        groupSubmission: true,
        groupingId: true,
      },
    });
    if (!assignment) throw new NotFoundException('Bài tập không tồn tại.');
    if (assignment.status !== 'PUBLISHED') throw new ForbiddenException('Bài tập chưa được đăng.');

    const files = this.sanitizeSubmissionFiles(body.files, assignment.maxFiles);

    const existing = await this.prisma.submission.findFirst({
      where: { assignmentId, studentId: user.id },
      orderBy: { attemptNumber: 'desc' },
    });

    if (existing?.status === 'GRADED')
      throw new ForbiddenException('Bài đã được chấm. Liên hệ giáo viên để nộp lại.');

    const now = new Date();
    const isLate = assignment.dueDate ? now > assignment.dueDate : false;
    const asDraft = body.asDraft ?? false;

    if (!existing && isLate && assignment.latePolicy === 'NONE') {
      if (!assignment.lateDeadline || now > assignment.lateDeadline)
        throw new ForbiddenException('Đã hết hạn nộp bài.');
    }

    const status = asDraft ? 'DRAFT' : isLate ? 'LATE' : 'SUBMITTED';

    // Nộp theo nhóm: tìm nhóm của học sinh trong grouping đã gán.
    let groupId: string | null = null;
    let teammateIds: string[] = [];
    if (assignment.groupSubmission && assignment.groupingId) {
      const group = await this.prisma.group.findFirst({
        where: {
          courseId: assignment.courseId,
          members: { some: { userId: user.id } },
          groupingLinks: { some: { groupingId: assignment.groupingId } },
        },
        select: { id: true, members: { select: { userId: true } } },
      });
      if (group) {
        groupId = group.id;
        teammateIds = group.members.map((m) => m.userId).filter((uid) => uid !== user.id);
      }
    }

    const sub = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.submission.update({
            where: { id: existing.id },
            data: {
              content: body.content,
              status,
              submittedAt: asDraft ? existing.submittedAt : now,
              groupId,
            },
          })
        : await tx.submission.create({
            data: {
              assignmentId,
              studentId: user.id,
              content: body.content,
              status,
              attemptNumber: 1,
              submittedAt: asDraft ? null : now,
              groupId,
            },
          });

      // Replace the file set with the list the client sent (its source of truth).
      await tx.submissionFile.deleteMany({ where: { submissionId: saved.id } });
      if (files.length > 0) {
        await tx.submissionFile.createMany({
          data: files.map((f) => ({ submissionId: saved.id, uploadedBy: user.id, ...f })),
        });
      }

      // Nhân bản bài nộp cho các thành viên còn lại của nhóm (chỉ khi nộp thật, không phải nháp).
      if (!asDraft && groupId && teammateIds.length > 0) {
        for (const memberId of teammateIds) {
          const memberExisting = await tx.submission.findFirst({
            where: { assignmentId, studentId: memberId },
            orderBy: { attemptNumber: 'desc' },
          });
          if (memberExisting?.status === 'GRADED') continue; // không ghi đè bài đã chấm
          const memberSub = memberExisting
            ? await tx.submission.update({
                where: { id: memberExisting.id },
                data: { content: body.content, status, submittedAt: now, groupId },
              })
            : await tx.submission.create({
                data: {
                  assignmentId,
                  studentId: memberId,
                  content: body.content,
                  status,
                  attemptNumber: 1,
                  submittedAt: now,
                  groupId,
                },
              });
          await tx.submissionFile.deleteMany({ where: { submissionId: memberSub.id } });
          if (files.length > 0) {
            await tx.submissionFile.createMany({
              data: files.map((f) => ({ submissionId: memberSub.id, uploadedBy: user.id, ...f })),
            });
          }
        }
      }

      return saved;
    });

    if (!asDraft) {
      logActivity(this.prisma, {
        userId: user.id,
        courseId: assignment.courseId,
        action: 'SUBMIT_ASSIGNMENT',
        resourceType: 'assignment',
        resourceId: assignmentId,
        resourceName: assignment.title,
      });
    }

    return {
      submissionId: sub.id,
      message: asDraft ? 'Đã lưu nháp.' : existing ? 'Đã cập nhật bài nộp.' : 'Đã nộp bài!',
    };
  }

  async gradeSubmission(
    user: AuthUser,
    submissionId: string,
    body: { score: number; feedback: string }
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const target = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        assignmentId: true,
        groupId: true,
        assignment: { select: { groupSubmission: true } },
      },
    });
    if (!target) throw new NotFoundException('Không tìm thấy bài nộp.');

    const data = {
      score: body.score,
      feedback: body.feedback,
      status: 'GRADED' as const,
      gradedAt: new Date(),
      gradedBy: user.id,
    };

    // Nộp theo nhóm: chấm 1 lần lan điểm cho toàn nhóm.
    if (target.assignment.groupSubmission && target.groupId) {
      const res = await this.prisma.submission.updateMany({
        where: { assignmentId: target.assignmentId, groupId: target.groupId },
        data,
      });
      return { message: `Đã lưu điểm cho cả nhóm (${res.count} bài).` };
    }

    await this.prisma.submission.update({ where: { id: submissionId }, data });
    return { message: 'Đã lưu điểm.' };
  }

  async deleteSubmission(user: AuthUser, submissionId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { courseId: true } } },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy bài nộp.');

    if (user.role !== 'ADMIN') {
      const course = await this.prisma.course.findUnique({
        where: { id: sub.assignment.courseId },
        select: { ownerId: true },
      });
      if (course?.ownerId !== user.id) throw new ForbiddenException('Không có quyền.');
    }

    await this.prisma.submission.delete({ where: { id: submissionId } });
    return { message: 'Đã xoá bài nộp.' };
  }
}
