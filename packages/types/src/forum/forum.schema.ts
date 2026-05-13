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
  authorId: z.string(),
  title: z.string(),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
  authorId: z.string(),
  title: z.string(),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: ForumAuthorSchema,
  course: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  posts: z.array(ForumPostSchema),
});
export type ForumTopicDetail = z.infer<typeof ForumTopicDetailSchema>;

// ── Query / Body schemas ───────────────────────────────────────

export const ForumTopicsQuerySchema = z.object({
  courseId: z.string().min(1),
});
export type ForumTopicsQuery = z.infer<typeof ForumTopicsQuerySchema>;

export const CreateTopicBodySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  content: z.string().min(10, 'Nội dung tối thiểu 10 ký tự'),
});
export type CreateTopicBody = z.infer<typeof CreateTopicBodySchema>;

export const UpdateTopicBodySchema = z.object({
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});
export type UpdateTopicBody = z.infer<typeof UpdateTopicBodySchema>;

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
