import { z } from 'zod';

// ── Author shape ───────────────────────────────────────────────

export const ForumAuthorSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string().nullable().optional(),
  role: z.string(),
});
export type ForumAuthor = z.infer<typeof ForumAuthorSchema>;

// ── Topic list (summary) ───────────────────────────────────────

export const TopicLastPostSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  author: z.object({
    id: z.string(),
    fullName: z.string().nullable().optional(),
    firstName: z.string(),
    lastName: z.string(),
  }),
});

export const ForumTopicSummarySchema = z.object({
  id: z.string(),
  courseId: z.string(),
  forumId: z.string().nullable().optional(),
  authorId: z.string(),
  title: z.string(),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  author: ForumAuthorSchema,
  _count: z.object({ posts: z.number() }),
  posts: z.array(TopicLastPostSchema),
});
export type ForumTopicSummary = z.infer<typeof ForumTopicSummarySchema>;

// ── Post / Reply ───────────────────────────────────────────────

export const ForumReplySchema = z.object({
  id: z.string(),
  content: z.string(),
  isAnswer: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  authorId: z.string(),
  author: ForumAuthorSchema,
});
export type ForumReply = z.infer<typeof ForumReplySchema>;

export const ForumPostSchema = ForumReplySchema.extend({
  replies: z.array(ForumReplySchema),
});
export type ForumPost = z.infer<typeof ForumPostSchema>;

// ── Topic detail ───────────────────────────────────────────────

export const ForumTopicDetailSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  forumId: z.string().nullable().optional(),
  forumTitle: z.string().nullable().optional(),
  authorId: z.string(),
  title: z.string(),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  author: ForumAuthorSchema,
  course: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  posts: z.array(ForumPostSchema),
});
export type ForumTopicDetail = z.infer<typeof ForumTopicDetailSchema>;

// ── Query / Body schemas ───────────────────────────────────────

export const ForumTopicsQuerySchema = z.object({
  courseId: z.string().min(1),
  /** Chỉ lấy chủ đề của một diễn đàn. Bỏ trống = mọi chủ đề của khoá học. */
  forumId: z.string().min(1).optional(),
});
export type ForumTopicsQuery = z.infer<typeof ForumTopicsQuerySchema>;

export const CreateTopicBodySchema = z.object({
  courseId: z.string().min(1),
  forumId: z.string().min(1).nullable().optional(),
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  content: z.string().min(10, 'Nội dung tối thiểu 10 ký tự'),
  groupId: z.string().min(1).nullable().optional(),
});
export type CreateTopicBody = z.infer<typeof CreateTopicBodySchema>;

export const UpdateTopicBodySchema = z.object({
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});
export type UpdateTopicBody = z.infer<typeof UpdateTopicBodySchema>;

export const UpdatePostBodySchema = z.object({
  content: z.string().min(1, 'Nội dung không được trống').max(50000),
});
export type UpdatePostBody = z.infer<typeof UpdatePostBodySchema>;

export const CreatePostBodySchema = z.object({
  topicId: z.string().min(1),
  content: z.string().min(1, 'Nội dung không được trống').max(10000),
  parentId: z.string().optional(),
});
export type CreatePostBody = z.infer<typeof CreatePostBodySchema>;

export const MarkAnswerBodySchema = z.object({
  isAnswer: z.boolean(),
});
export type MarkAnswerBody = z.infer<typeof MarkAnswerBodySchema>;

// ── Diễn đàn như một hoạt động trong chương ────────────────────

export const CreateForumBodySchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  title: z.string().min(3, 'Tên diễn đàn tối thiểu 3 ký tự').max(200),
  description: z.string().max(5000).optional(),
});
export type CreateForumBody = z.infer<typeof CreateForumBodySchema>;

export const UpdateForumBodySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
});
export type UpdateForumBody = z.infer<typeof UpdateForumBodySchema>;

export type ForumSummary = {
  id: string;
  title: string;
  description: string | null;
  /** ModuleItem tương ứng — dùng để ẩn/hiện và xoá từ trang Chương. */
  moduleItemId: string | null;
  isPublished: boolean;
  topicCount: number;
  postCount: number;
  lastActivityAt: string | null;
};

/** Diễn đàn của khoá, nhóm theo chương — giống cách tab Bài tập bày nội dung. */
export type ForumModuleGroup = {
  moduleId: string | null;
  moduleName: string;
  modulePosition: number;
  forums: ForumSummary[];
};

export type CourseForums = {
  groups: ForumModuleGroup[];
  /** Chủ đề cấp khoá học tạo trước khi có diễn đàn — không thuộc chương nào. */
  legacyTopicCount: number;
};
