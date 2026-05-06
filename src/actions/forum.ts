'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';
import type { UserRole } from '@prisma/client';
import type { ActionResult } from './auth';

// ── Schemas ───────────────────────────────────────────────────

const topicSchema = z.object({
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  content: z.string().min(10, 'Nội dung tối thiểu 10 ký tự'),
});

const postSchema = z.object({
  content: z.string().min(1, 'Nội dung không được trống').max(10000),
  parentId: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────

async function assertEnrolled(courseId: string, userId: string, role: UserRole) {
  if (hasMinRole(role, 'TEACHER')) return true;
  const enrollment = await prisma.enrollment.findFirst({
    where: { courseId, userId, status: 'ACTIVE' },
  });
  if (!enrollment) throw new Error('Bạn không phải thành viên của khoá học này');
  return true;
}

// ── Topic Actions ─────────────────────────────────────────────

export async function createTopicAction(
  courseId: string,
  data: z.infer<typeof topicSchema>,
): Promise<ActionResult<{ topicId: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    await assertEnrolled(courseId, userId, role);
    const validated = topicSchema.parse(data);

    const topic = await prisma.$transaction(async (tx) => {
      const t = await tx.forumTopic.create({
        data: { courseId, authorId: userId, title: validated.title },
      });
      await tx.forumPost.create({
        data: { topicId: t.id, authorId: userId, content: validated.content },
      });
      return t;
    });

    return { success: true, message: 'Đã tạo chủ đề', data: { topicId: topic.id } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Lỗi tạo chủ đề' };
  }
}

export async function listTopicsAction(courseId: string) {
  const session = await auth();
  if (!session?.user) return [];

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    await assertEnrolled(courseId, userId, role);
  } catch {
    return [];
  }

  const topics = await prisma.forumTopic.findMany({
    where: { courseId },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    include: {
      author: { select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true, role: true } },
      _count: { select: { posts: true } },
      posts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          author: { select: { id: true, fullName: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return topics;
}

export async function getTopicAction(topicId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  const topic = await prisma.forumTopic.findUnique({
    where: { id: topicId },
    include: {
      course: { select: { id: true, slug: true, name: true } },
      author: { select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true, role: true } },
      posts: {
        where: { parentId: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true, role: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true, role: true } },
            },
          },
        },
      },
    },
  });

  if (!topic) return null;

  try {
    await assertEnrolled(topic.course.id, userId, role);
  } catch {
    return null;
  }

  // Increment view count (non-blocking)
  prisma.forumTopic.update({ where: { id: topicId }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return topic;
}

export async function createPostAction(
  topicId: string,
  data: z.infer<typeof postSchema>,
): Promise<ActionResult<{ postId: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: { course: { select: { id: true } } },
    });
    if (!topic) return { success: false, error: 'Không tìm thấy chủ đề' };
    if (topic.isLocked && !hasMinRole(role, 'TEACHER'))
      return { success: false, error: 'Chủ đề đã bị khoá' };

    await assertEnrolled(topic.course.id, userId, role);
    const validated = postSchema.parse(data);

    const post = await prisma.forumPost.create({
      data: {
        topicId,
        authorId: userId,
        content: validated.content,
        parentId: validated.parentId ?? null,
      },
    });

    // Surface topic in listing by bumping updatedAt
    await prisma.forumTopic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });

    // Notify topic author if someone else replied
    if (topic.authorId !== userId && !validated.parentId) {
      createNotification({
        userId: topic.authorId,
        type: 'FORUM_REPLY',
        title: 'Có người trả lời chủ đề của bạn',
        body: topic.title,
        link: `/courses/${topic.course.id}/forum/${topicId}`,
      }).catch(() => {});
    }

    return { success: true, message: 'Đã đăng trả lời', data: { postId: post.id } };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Lỗi đăng bài' };
  }
}

export async function updateTopicAction(
  topicId: string,
  data: { isPinned?: boolean; isLocked?: boolean },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền' };

  try {
    await prisma.forumTopic.update({ where: { id: topicId }, data });
    return { success: true, message: 'Đã cập nhật' };
  } catch {
    return { success: false, error: 'Lỗi cập nhật chủ đề' };
  }
}

export async function markAnswerAction(
  postId: string,
  isAnswer: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: { topic: { select: { authorId: true } } },
    });
    if (!post) return { success: false, error: 'Không tìm thấy bài' };

    const canMark = hasMinRole(role, 'TEACHER') || post.topic.authorId === userId;
    if (!canMark) return { success: false, error: 'Không có quyền' };

    await prisma.forumPost.update({ where: { id: postId }, data: { isAnswer } });
    return { success: true, message: 'Đã cập nhật' };
  } catch {
    return { success: false, error: 'Lỗi cập nhật' };
  }
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return { success: false, error: 'Không tìm thấy bài' };

    const canDelete = hasMinRole(role, 'TEACHER') || post.authorId === userId;
    if (!canDelete) return { success: false, error: 'Không có quyền' };

    await prisma.forumPost.delete({ where: { id: postId } });
    return { success: true, message: 'Đã xoá' };
  } catch {
    return { success: false, error: 'Lỗi xoá bài' };
  }
}

export async function deleteTopicAction(topicId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const role = session.user.role as UserRole;
  const userId = session.user.id!;

  try {
    const topic = await prisma.forumTopic.findUnique({ where: { id: topicId } });
    if (!topic) return { success: false, error: 'Không tìm thấy chủ đề' };

    const canDelete = hasMinRole(role, 'TEACHER') || topic.authorId === userId;
    if (!canDelete) return { success: false, error: 'Không có quyền' };

    await prisma.forumTopic.delete({ where: { id: topicId } });
    return { success: true, message: 'Đã xoá' };
  } catch {
    return { success: false, error: 'Lỗi xoá chủ đề' };
  }
}
