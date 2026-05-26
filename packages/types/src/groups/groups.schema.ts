import { z } from 'zod';

// ── Group mode ─────────────────────────────────────────────────

export const GROUP_MODES = [
  { value: 'NO_GROUPS', label: 'Không có nhóm', description: 'Cả lớp học chung, không chia nhóm.' },
  {
    value: 'SEPARATE_GROUPS',
    label: 'Nhóm riêng biệt',
    description: 'Mỗi nhóm hoạt động độc lập, chỉ thấy nội dung của nhóm mình.',
  },
  {
    value: 'VISIBLE_GROUPS',
    label: 'Nhóm hiện hữu',
    description: 'Nhóm hoạt động riêng nhưng vẫn xem được nội dung của nhóm khác (chỉ xem).',
  },
] as const;

export type GroupModeValue = (typeof GROUP_MODES)[number]['value'];

export const GROUP_MODE_LABEL: Record<GroupModeValue, string> = Object.fromEntries(
  GROUP_MODES.map((m) => [m.value, m.label])
) as Record<GroupModeValue, string>;

// ── Zod bodies ─────────────────────────────────────────────────

export const SetGroupModeBodySchema = z.object({
  groupMode: z.enum(['NO_GROUPS', 'SEPARATE_GROUPS', 'VISIBLE_GROUPS']),
});
export type SetGroupModeBody = z.infer<typeof SetGroupModeBodySchema>;

export const CreateGroupBodySchema = z.object({
  name: z.string().min(1, 'Tên nhóm không được trống').max(200),
  description: z.string().max(2000).nullable().optional(),
});
export type CreateGroupBody = z.infer<typeof CreateGroupBodySchema>;

export const UpdateGroupBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateGroupBody = z.infer<typeof UpdateGroupBodySchema>;

export const AddGroupMembersBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(500),
});
export type AddGroupMembersBody = z.infer<typeof AddGroupMembersBodySchema>;

export const CreateGroupingBodySchema = z.object({
  name: z.string().min(1, 'Tên phân nhóm không được trống').max(200),
  description: z.string().max(2000).nullable().optional(),
  groupIds: z.array(z.string().min(1)).max(500).optional(),
});
export type CreateGroupingBody = z.infer<typeof CreateGroupingBodySchema>;

export const UpdateGroupingBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  groupIds: z.array(z.string().min(1)).max(500).optional(),
});
export type UpdateGroupingBody = z.infer<typeof UpdateGroupingBodySchema>;

// Chia nhóm tự động: tạo N nhóm (+ 1 grouping gộp), xếp ngẫu nhiên hoặc để trống cho tự xếp.
export const AutoDistributeBodySchema = z.object({
  groupCount: z.number().int().min(1).max(100),
  groupingName: z.string().min(1).max(200),
  namePrefix: z.string().max(100).optional(),
  random: z.boolean().optional().default(true),
});
export type AutoDistributeBody = z.infer<typeof AutoDistributeBodySchema>;

// ── Response types ─────────────────────────────────────────────

export type GroupMemberUser = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
};

export type GroupMemberItem = {
  id: string;
  userId: string;
  user: GroupMemberUser;
};

export type GroupItem = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  position: number;
  members: GroupMemberItem[];
};

export type GroupingItem = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  groupIds: string[];
};

export type CourseGroupsData = {
  groupMode: GroupModeValue;
  groups: GroupItem[];
  groupings: GroupingItem[];
};

// Nhóm của học sinh (dùng cho student-facing).
export type MyGroupSummary = {
  id: string;
  name: string;
};
