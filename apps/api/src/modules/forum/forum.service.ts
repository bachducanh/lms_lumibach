import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  CreatePostBody,
  CreateTopicBody,
  ForumTopicDetail,
  ForumTopicSummary,
  MarkAnswerBody,
  UpdateTopicBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const TOPIC_LIST_TTL_MS = 30_000;
const TOPIC_DETAIL_TTL_MS = 30_000;

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  avatar: true,
  role: true,
} as const;

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  async listTopics(user: AuthUser, courseId: string): Promise<ForumTopicSummary[]> {
    await this.assertEnrolled(courseId, user.id, user.role);
    const all = await this.cached(`forum:topics:${courseId}`, TOPIC_LIST_TTL_MS, async () => {
      const topics = await this.prisma.forumTopic.findMany({
        where: { courseId },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        include: {
          author: { select: AUTHOR_SELECT },
          group: { select: { name: true } },
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
      return topics.map((t) => ({
        id: t.id,
        courseId: t.courseId,
        authorId: t.authorId,
        title: t.title,
        isPinned: t.isPinned,
        isLocked: t.isLocked,
        viewCount: t.viewCount,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        groupId: t.groupId,
        groupName: t.group?.name ?? null,
        author: t.author,
        _count: t._count,
        posts: t.posts.map((p) => ({
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          author: p.author,
        })),
      }));
    });

    return this.filterTopicsForUser(user, courseId, all);
  }

  // Lọc topic theo chế độ nhóm (per-user, sau cache).
  private async filterTopicsForUser(
    user: AuthUser,
    courseId: string,
    topics: ForumTopicSummary[]
  ): Promise<ForumTopicSummary[]> {
    if (hasMinRole(user.role, 'TA')) return topics;
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { groupMode: true },
    });
    if (!course || course.groupMode !== 'SEPARATE_GROUPS') return topics;
    const myGroups = await this.prisma.group.findMany({
      where: { courseId, members: { some: { userId: user.id } } },
      select: { id: true },
    });
    const ids = new Set(myGroups.map((g) => g.id));
    return topics.filter((t) => !t.groupId || ids.has(t.groupId));
  }

  private async resolveTopicGroupId(
    user: AuthUser,
    courseId: string,
    requested: string | null | undefined
  ): Promise<string | null> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { groupMode: true },
    });
    if (!course || course.groupMode === 'NO_GROUPS') return null;

    if (hasMinRole(user.role, 'TA')) {
      if (requested) {
        const g = await this.prisma.group.findFirst({
          where: { id: requested, courseId },
          select: { id: true },
        });
        return g ? requested : null;
      }
      return null;
    }

    const myGroups = await this.prisma.group.findMany({
      where: { courseId, members: { some: { userId: user.id } } },
      select: { id: true },
    });
    if (myGroups.length === 0) return null;
    if (requested && myGroups.some((g) => g.id === requested)) return requested;
    return myGroups[0]!.id;
  }

  async getTopic(user: AuthUser, topicId: string): Promise<ForumTopicDetail> {
    const data = await this.cached(`forum:topic:${topicId}`, TOPIC_DETAIL_TTL_MS, async () => {
      const topic = await this.prisma.forumTopic.findUnique({
        where: { id: topicId },
        include: {
          course: { select: { id: true, slug: true, name: true } },
          author: { select: AUTHOR_SELECT },
          group: { select: { name: true } },
          posts: {
            where: { parentId: null },
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: AUTHOR_SELECT },
              replies: {
                orderBy: { createdAt: 'asc' },
                include: { author: { select: AUTHOR_SELECT } },
              },
            },
          },
        },
      });
      if (!topic) throw new NotFoundException('Không tìm thấy chủ đề');

      const result: ForumTopicDetail = {
        id: topic.id,
        courseId: topic.courseId,
        authorId: topic.authorId,
        title: topic.title,
        isPinned: topic.isPinned,
        isLocked: topic.isLocked,
        viewCount: topic.viewCount,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
        groupId: topic.groupId,
        groupName: topic.group?.name ?? null,
        author: topic.author,
        course: topic.course,
        posts: topic.posts.map((p) => ({
          id: p.id,
          content: p.content,
          isAnswer: p.isAnswer,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          authorId: p.authorId,
          author: p.author,
          replies: p.replies.map((r) => ({
            id: r.id,
            content: r.content,
            isAnswer: r.isAnswer,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            authorId: r.authorId,
            author: r.author,
          })),
        })),
      };
      return result;
    });

    // Enrollment check always runs per-request (outside cache)
    await this.assertEnrolled(data.courseId, user.id, user.role);

    // Chế độ nhóm riêng biệt: học sinh không xem được chủ đề của nhóm khác.
    if (!hasMinRole(user.role, 'TA') && data.groupId) {
      const course = await this.prisma.course.findUnique({
        where: { id: data.courseId },
        select: { groupMode: true },
      });
      if (course?.groupMode === 'SEPARATE_GROUPS') {
        const member = await this.prisma.groupMember.findFirst({
          where: { groupId: data.groupId, userId: user.id },
          select: { id: true },
        });
        if (!member) throw new ForbiddenException('Chủ đề thuộc nhóm khác.');
      }
    }

    // Increment view count non-blocking
    this.prisma.forumTopic
      .update({ where: { id: topicId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return data;
  }

  async createTopic(user: AuthUser, body: CreateTopicBody): Promise<{ topicId: string }> {
    await this.assertEnrolled(body.courseId, user.id, user.role);
    const groupId = await this.resolveTopicGroupId(user, body.courseId, body.groupId);
    const topic = await this.prisma.$transaction(async (tx) => {
      const t = await tx.forumTopic.create({
        data: { courseId: body.courseId, authorId: user.id, title: body.title, groupId },
      });
      await tx.forumPost.create({
        data: { topicId: t.id, authorId: user.id, content: body.content },
      });
      return t;
    });
    await this.cache.del(`forum:topics:${body.courseId}`);
    return { topicId: topic.id };
  }

  async updateTopic(user: AuthUser, topicId: string, body: UpdateTopicBody): Promise<void> {
    if (!hasMinRole(user.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    await this.prisma.forumTopic.update({ where: { id: topicId }, data: body });
    await this.cache.del(`forum:topic:${topicId}`);
  }

  async deleteTopic(user: AuthUser, topicId: string): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề');
    if (!hasMinRole(user.role, 'TEACHER') && topic.authorId !== user.id)
      throw new ForbiddenException('Không có quyền');
    await this.prisma.forumTopic.delete({ where: { id: topicId } });
    await Promise.all([
      this.cache.del(`forum:topics:${topic.courseId}`),
      this.cache.del(`forum:topic:${topicId}`),
    ]);
  }

  async createPost(user: AuthUser, body: CreatePostBody): Promise<{ postId: string }> {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: body.topicId },
      include: { course: { select: { id: true, slug: true } } },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề');
    if (topic.isLocked && !hasMinRole(user.role, 'TEACHER'))
      throw new ForbiddenException('Chủ đề đã bị khoá');
    await this.assertEnrolled(topic.course.id, user.id, user.role);

    const post = await this.prisma.forumPost.create({
      data: {
        topicId: body.topicId,
        authorId: user.id,
        content: body.content,
        parentId: body.parentId ?? null,
      },
    });
    await this.prisma.forumTopic.update({
      where: { id: body.topicId },
      data: { updatedAt: new Date() },
    });

    if (topic.authorId !== user.id && !body.parentId) {
      this.notifyForumReply(topic.authorId, topic.id, topic.title, topic.course.slug).catch(
        () => {}
      );
    }

    await Promise.all([
      this.cache.del(`forum:topics:${topic.courseId}`),
      this.cache.del(`forum:topic:${body.topicId}`),
    ]);
    return { postId: post.id };
  }

  async markAnswer(user: AuthUser, postId: string, body: MarkAnswerBody): Promise<void> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: { topic: { select: { id: true, authorId: true } } },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài');
    if (!hasMinRole(user.role, 'TEACHER') && post.topic.authorId !== user.id)
      throw new ForbiddenException('Không có quyền');
    await this.prisma.forumPost.update({
      where: { id: postId },
      data: { isAnswer: body.isAnswer },
    });
    await this.cache.del(`forum:topic:${post.topicId}`);
  }

  async deletePost(user: AuthUser, postId: string): Promise<void> {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài');
    if (!hasMinRole(user.role, 'TEACHER') && post.authorId !== user.id)
      throw new ForbiddenException('Không có quyền');
    await this.prisma.forumPost.delete({ where: { id: postId } });
    await this.cache.del(`forum:topic:${post.topicId}`);
  }

  // ── Internals ──────────────────────────────────────────────────

  private async assertEnrolled(courseId: string, userId: string, role: string): Promise<void> {
    if (hasMinRole(role, 'TEACHER')) return;
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { courseId, userId, status: 'ACTIVE' },
    });
    if (!enrollment) throw new ForbiddenException('Bạn không phải thành viên của khoá học này');
  }

  private async notifyForumReply(
    targetUserId: string,
    topicId: string,
    topicTitle: string,
    courseSlug: string
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'FORUM_REPLY',
        title: 'Có người trả lời chủ đề của bạn',
        body: topicTitle,
        link: `/courses/${courseSlug}/forum/${topicId}`,
      },
    });
  }

  private async cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'test') return factory();
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }
}
