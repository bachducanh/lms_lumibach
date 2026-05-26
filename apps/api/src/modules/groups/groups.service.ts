import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  AddGroupMembersBody,
  AutoDistributeBody,
  CourseGroupsData,
  CreateGroupBody,
  CreateGroupingBody,
  GroupItem,
  GroupMemberItem,
  GroupModeValue,
  GroupingItem,
  MyGroupSummary,
  SetGroupModeBody,
  UpdateGroupBody,
  UpdateGroupingBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const MEMBER_USER_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Access ───────────────────────────────────────────────────

  private async getAccess(
    user: AuthUser,
    courseId: string
  ): Promise<{ canManage: boolean; isStaff: boolean }> {
    if (user.role === 'ADMIN') return { canManage: true, isStaff: true };
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại.');
    if (user.role === 'TEACHER' && course.ownerId === user.id)
      return { canManage: true, isStaff: true };
    const coTeacher = await this.prisma.courseCoTeacher.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (coTeacher) return { canManage: true, isStaff: true };
    const ta = await this.prisma.teachingAssistant.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (ta) return { canManage: false, isStaff: true };
    return { canManage: false, isStaff: false };
  }

  private async assertManage(user: AuthUser, courseId: string): Promise<void> {
    const { canManage } = await this.getAccess(user, courseId);
    if (!canManage) throw new ForbiddenException('Không có quyền quản lý nhóm khoá học này.');
  }

  private async assertStaff(user: AuthUser, courseId: string): Promise<void> {
    const { isStaff } = await this.getAccess(user, courseId);
    if (!isStaff) throw new ForbiddenException('Không có quyền xem nhóm khoá học này.');
  }

  private async courseIdOfGroup(groupId: string): Promise<string> {
    const g = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { courseId: true },
    });
    if (!g) throw new NotFoundException('Nhóm không tồn tại.');
    return g.courseId;
  }

  private async courseIdOfGrouping(groupingId: string): Promise<string> {
    const g = await this.prisma.grouping.findUnique({
      where: { id: groupingId },
      select: { courseId: true },
    });
    if (!g) throw new NotFoundException('Phân nhóm không tồn tại.');
    return g.courseId;
  }

  // ── Read ─────────────────────────────────────────────────────

  async getCourseGroups(user: AuthUser, courseId: string): Promise<CourseGroupsData> {
    await this.assertStaff(user, courseId);

    const [course, groups, groupings] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId }, select: { groupMode: true } }),
      this.prisma.group.findMany({
        where: { courseId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          members: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: MEMBER_USER_SELECT } },
          },
        },
      }),
      this.prisma.grouping.findMany({
        where: { courseId },
        orderBy: { createdAt: 'asc' },
        include: { groups: { select: { groupId: true } } },
      }),
    ]);

    return {
      groupMode: (course?.groupMode ?? 'NO_GROUPS') as GroupModeValue,
      groups: groups.map((g) => this.toGroupItem(g)),
      groupings: groupings.map(
        (gr): GroupingItem => ({
          id: gr.id,
          courseId: gr.courseId,
          name: gr.name,
          description: gr.description,
          groupIds: gr.groups.map((x) => x.groupId),
        })
      ),
    };
  }

  async getMyGroups(user: AuthUser, courseId: string): Promise<MyGroupSummary[]> {
    const groups = await this.prisma.group.findMany({
      where: { courseId, members: { some: { userId: user.id } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return groups;
  }

  // ── Group mode ───────────────────────────────────────────────

  async setGroupMode(
    user: AuthUser,
    courseId: string,
    body: SetGroupModeBody
  ): Promise<{ message: string }> {
    await this.assertManage(user, courseId);
    await this.prisma.course.update({
      where: { id: courseId },
      data: { groupMode: body.groupMode },
    });
    return { message: 'Đã cập nhật chế độ nhóm.' };
  }

  // ── Group CRUD ───────────────────────────────────────────────

  async createGroup(user: AuthUser, courseId: string, body: CreateGroupBody): Promise<GroupItem> {
    await this.assertManage(user, courseId);
    const last = await this.prisma.group.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await this.prisma.group.create({
      data: {
        courseId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        position: (last?.position ?? -1) + 1,
      },
      include: { members: { include: { user: { select: MEMBER_USER_SELECT } } } },
    });
    return this.toGroupItem(created);
  }

  async updateGroup(
    user: AuthUser,
    id: string,
    body: UpdateGroupBody
  ): Promise<{ message: string }> {
    const courseId = await this.courseIdOfGroup(id);
    await this.assertManage(user, courseId);
    await this.prisma.group.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.position !== undefined && { position: body.position }),
      },
    });
    return { message: 'Đã cập nhật nhóm.' };
  }

  async deleteGroup(user: AuthUser, id: string): Promise<{ message: string }> {
    const courseId = await this.courseIdOfGroup(id);
    await this.assertManage(user, courseId);
    await this.prisma.group.delete({ where: { id } });
    return { message: 'Đã xoá nhóm.' };
  }

  // ── Members ──────────────────────────────────────────────────

  async addMembers(
    user: AuthUser,
    groupId: string,
    body: AddGroupMembersBody
  ): Promise<{ message: string; added: number }> {
    const courseId = await this.courseIdOfGroup(groupId);
    await this.assertManage(user, courseId);

    // Chỉ thêm user đã ghi danh khoá học.
    const enrolled = await this.prisma.enrollment.findMany({
      where: { courseId, userId: { in: body.userIds } },
      select: { userId: true },
    });
    const validIds = enrolled.map((e) => e.userId);
    if (validIds.length === 0) return { message: 'Không có học sinh hợp lệ để thêm.', added: 0 };

    const res = await this.prisma.groupMember.createMany({
      data: validIds.map((userId) => ({ groupId, userId })),
      skipDuplicates: true,
    });
    return { message: `Đã thêm ${res.count} thành viên.`, added: res.count };
  }

  async removeMember(
    user: AuthUser,
    groupId: string,
    userId: string
  ): Promise<{ message: string }> {
    const courseId = await this.courseIdOfGroup(groupId);
    await this.assertManage(user, courseId);
    await this.prisma.groupMember.deleteMany({ where: { groupId, userId } });
    return { message: 'Đã xoá thành viên khỏi nhóm.' };
  }

  // ── Grouping CRUD ────────────────────────────────────────────

  async createGrouping(
    user: AuthUser,
    courseId: string,
    body: CreateGroupingBody
  ): Promise<GroupingItem> {
    await this.assertManage(user, courseId);
    const groupIds = await this.validGroupIds(courseId, body.groupIds ?? []);
    const created = await this.prisma.grouping.create({
      data: {
        courseId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        groups: { create: groupIds.map((groupId) => ({ groupId })) },
      },
      include: { groups: { select: { groupId: true } } },
    });
    return {
      id: created.id,
      courseId: created.courseId,
      name: created.name,
      description: created.description,
      groupIds: created.groups.map((x) => x.groupId),
    };
  }

  async updateGrouping(
    user: AuthUser,
    id: string,
    body: UpdateGroupingBody
  ): Promise<{ message: string }> {
    const courseId = await this.courseIdOfGrouping(id);
    await this.assertManage(user, courseId);

    const groupIds =
      body.groupIds !== undefined ? await this.validGroupIds(courseId, body.groupIds) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.grouping.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name.trim() }),
          ...(body.description !== undefined && { description: body.description?.trim() || null }),
        },
      });
      if (groupIds !== null) {
        await tx.groupingGroup.deleteMany({ where: { groupingId: id } });
        if (groupIds.length > 0) {
          await tx.groupingGroup.createMany({
            data: groupIds.map((groupId) => ({ groupingId: id, groupId })),
            skipDuplicates: true,
          });
        }
      }
    });
    return { message: 'Đã cập nhật phân nhóm.' };
  }

  async deleteGrouping(user: AuthUser, id: string): Promise<{ message: string }> {
    const courseId = await this.courseIdOfGrouping(id);
    await this.assertManage(user, courseId);
    await this.prisma.grouping.delete({ where: { id } });
    return { message: 'Đã xoá phân nhóm.' };
  }

  // ── Auto distribute ──────────────────────────────────────────

  async autoDistribute(
    user: AuthUser,
    courseId: string,
    body: AutoDistributeBody
  ): Promise<GroupingItem> {
    await this.assertManage(user, courseId);

    const prefix = body.namePrefix?.trim() || 'Nhóm';
    const lastPos = await this.prisma.group.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let pos = (lastPos?.position ?? -1) + 1;

    let students: { userId: string }[] = [];
    if (body.random) {
      students = await this.prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE', user: { role: 'STUDENT' } },
        select: { userId: true },
      });
      // Fisher–Yates shuffle
      for (let i = students.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [students[i], students[j]] = [students[j]!, students[i]!];
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const grouping = await tx.grouping.create({
        data: { courseId, name: body.groupingName.trim() },
      });

      const groupIds: string[] = [];
      for (let i = 0; i < body.groupCount; i++) {
        const group = await tx.group.create({
          data: { courseId, name: `${prefix} ${i + 1}`, position: pos++ },
        });
        groupIds.push(group.id);
        await tx.groupingGroup.create({ data: { groupingId: grouping.id, groupId: group.id } });
      }

      if (students.length > 0) {
        const memberData = students.map((s, idx) => ({
          groupId: groupIds[idx % groupIds.length]!,
          userId: s.userId,
        }));
        await tx.groupMember.createMany({ data: memberData, skipDuplicates: true });
      }

      return {
        id: grouping.id,
        courseId,
        name: grouping.name,
        description: grouping.description,
        groupIds,
      };
    });

    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async validGroupIds(courseId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await this.prisma.group.findMany({
      where: { id: { in: ids }, courseId },
      select: { id: true },
    });
    return found.map((g) => g.id);
  }

  private toGroupItem(g: {
    id: string;
    courseId: string;
    name: string;
    description: string | null;
    position: number;
    members: { id: string; userId: string; user: GroupMemberItem['user'] }[];
  }): GroupItem {
    return {
      id: g.id,
      courseId: g.courseId,
      name: g.name,
      description: g.description,
      position: g.position,
      members: g.members.map(
        (m): GroupMemberItem => ({ id: m.id, userId: m.userId, user: m.user })
      ),
    };
  }
}
