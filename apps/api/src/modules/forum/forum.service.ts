import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  CourseForums,
  CreateForumBody,
  CreatePostBody,
  CreateTopicBody,
  ForumModuleGroup,
  ForumSummary,
  ForumTopicDetail,
  ForumTopicSummary,
  MarkAnswerBody,
  UpdateForumBody,
  UpdatePostBody,
  UpdateTopicBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageActivity } from '../../common/bank/course-scoped';

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

  async listTopics(
    user: AuthUser,
    courseId: string,
    forumId?: string
  ): Promise<ForumTopicSummary[]> {
    await this.assertEnrolled(courseId, user.id, user.role);
    const cacheKey = forumId ? `forum:topics:${courseId}:${forumId}` : `forum:topics:${courseId}`;
    const all = await this.cached(cacheKey, TOPIC_LIST_TTL_MS, async () => {
      const topics = await this.prisma.forumTopic.findMany({
        where: { courseId, ...(forumId ? { forumId } : {}) },
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
        forumId: t.forumId,
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
          forum: { select: { title: true } },
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
        forumId: topic.forumId,
        forumTitle: topic.forum?.title ?? null,
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

    // Diễn đàn phải thuộc đúng khoá học — chặn việc đăng xuyên khoá bằng id đoán được.
    let forumId: string | null = null;
    if (body.forumId) {
      const forum = await this.prisma.forum.findFirst({
        where: { id: body.forumId, courseId: body.courseId },
        select: { id: true },
      });
      if (!forum) throw new NotFoundException('Diễn đàn không tồn tại trong khoá học này');
      forumId = forum.id;
    }

    const topic = await this.prisma.$transaction(async (tx) => {
      const t = await tx.forumTopic.create({
        data: { courseId: body.courseId, forumId, authorId: user.id, title: body.title, groupId },
      });
      await tx.forumPost.create({
        data: { topicId: t.id, authorId: user.id, content: body.content },
      });
      return t;
    });
    await this.invalidateTopicLists(body.courseId, forumId);
    return { topicId: topic.id };
  }

  async updateTopic(user: AuthUser, topicId: string, body: UpdateTopicBody): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { courseId: true, forumId: true, authorId: true },
    });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề');

    // Ghim / khoá là thao tác điều hành, chỉ GV trở lên. Sửa tiêu đề thì tác giả
    // cũng được, giống quyền sửa nội dung ở updatePost.
    const isStaff = hasMinRole(user.role, 'TEACHER');
    const onlyTitle = body.isPinned === undefined && body.isLocked === undefined;
    if (!isStaff && !(onlyTitle && topic.authorId === user.id)) {
      throw new ForbiddenException('Không có quyền');
    }

    await this.prisma.forumTopic.update({ where: { id: topicId }, data: body });
    await Promise.all([
      this.invalidateTopicLists(topic.courseId, topic.forumId),
      this.cache.del(`forum:topic:${topicId}`),
    ]);
  }

  /**
   * Sửa nội dung một bài viết. Bài đầu tiên của chủ đề chính là phần thân chủ
   * đề, nên đây cũng là đường để quản lý / giáo viên / trợ giảng sửa nội dung
   * chủ đề do người khác viết.
   */
  async updatePost(user: AuthUser, postId: string, body: UpdatePostBody): Promise<void> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: {
        authorId: true,
        topicId: true,
        topic: { select: { courseId: true, forumId: true } },
      },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (!hasMinRole(user.role, 'TA') && post.authorId !== user.id)
      throw new ForbiddenException('Không có quyền');

    await this.prisma.forumPost.update({ where: { id: postId }, data: { content: body.content } });
    await Promise.all([
      this.invalidateTopicLists(post.topic.courseId, post.topic.forumId),
      this.cache.del(`forum:topic:${post.topicId}`),
    ]);
  }

  async deleteTopic(user: AuthUser, topicId: string): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Không tìm thấy chủ đề');
    if (!hasMinRole(user.role, 'TEACHER') && topic.authorId !== user.id)
      throw new ForbiddenException('Không có quyền');
    await this.prisma.forumTopic.delete({ where: { id: topicId } });
    await Promise.all([
      this.invalidateTopicLists(topic.courseId, topic.forumId),
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
      this.invalidateTopicLists(topic.courseId, topic.forumId),
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

  // ── Diễn đàn (hoạt động trong chương) ──────────────────────────

  /**
   * Diễn đàn của khoá, nhóm theo chương — bày giống tab Bài tập.
   *
   * Học sinh chỉ thấy diễn đàn đã đăng; giáo viên thấy cả bản nháp để còn sửa.
   * Chủ đề cũ (tạo trước khi có model Forum) không thuộc chương nào, trả về
   * dưới dạng legacyTopicCount để trang forum còn chỗ dẫn tới chúng.
   */
  async listForums(user: AuthUser, courseId: string): Promise<CourseForums> {
    await this.assertEnrolled(courseId, user.id, user.role);
    const canManage = await this.canManageForums(user, courseId);

    const [forums, legacyTopicCount] = await Promise.all([
      this.prisma.forum.findMany({
        where: { courseId },
        include: {
          moduleItems: {
            include: { module: { select: { id: true, name: true, position: true } } },
          },
          topics: {
            select: { updatedAt: true, _count: { select: { posts: true } } },
          },
        },
      }),
      this.prisma.forumTopic.count({ where: { courseId, forumId: null } }),
    ]);

    const groups = new Map<string, ForumModuleGroup>();
    for (const forum of forums) {
      const item = forum.moduleItems[0];
      if (!canManage && !item?.isPublished) continue;

      const key = item?.module.id ?? '__none__';
      const group = groups.get(key) ?? {
        moduleId: item?.module.id ?? null,
        moduleName: item?.module.name ?? 'Chưa thuộc chương nào',
        // Mục chưa gắn chương xếp cuối.
        modulePosition: item?.module.position ?? Number.MAX_SAFE_INTEGER,
        forums: [],
      };

      const lastActivity = forum.topics.reduce<Date | null>(
        (latest, t) => (!latest || t.updatedAt > latest ? t.updatedAt : latest),
        null
      );

      group.forums.push({
        id: forum.id,
        title: forum.title,
        description: forum.description,
        moduleItemId: item?.id ?? null,
        isPublished: item?.isPublished ?? false,
        topicCount: forum.topics.length,
        postCount: forum.topics.reduce((n, t) => n + t._count.posts, 0),
        lastActivityAt: lastActivity?.toISOString() ?? null,
      } satisfies ForumSummary);
      groups.set(key, group);
    }

    return {
      groups: [...groups.values()].sort((a, b) => a.modulePosition - b.modulePosition),
      legacyTopicCount,
    };
  }

  async getForum(
    user: AuthUser,
    forumId: string
  ): Promise<ForumSummary & { courseId: string; courseSlug: string; moduleName: string | null }> {
    const forum = await this.prisma.forum.findUnique({
      where: { id: forumId },
      include: {
        course: { select: { id: true, slug: true } },
        moduleItems: { include: { module: { select: { name: true } } } },
        topics: { select: { updatedAt: true, _count: { select: { posts: true } } } },
      },
    });
    if (!forum) throw new NotFoundException('Diễn đàn không tồn tại');
    // Diễn đàn mẫu của ngân hàng danh mục không có lớp để ghi danh vào; xem nó
    // ở trang ngân hàng, không phải ở đường diễn đàn của khoá học.
    if (!forum.course) throw new NotFoundException('Diễn đàn không tồn tại');
    const course = forum.course;
    await this.assertEnrolled(course.id, user.id, user.role);

    const item = forum.moduleItems[0];
    if (!item?.isPublished && !(await this.canManageForums(user, course.id))) {
      throw new ForbiddenException('Diễn đàn chưa được mở');
    }

    const lastActivity = forum.topics.reduce<Date | null>(
      (latest, t) => (!latest || t.updatedAt > latest ? t.updatedAt : latest),
      null
    );

    return {
      id: forum.id,
      title: forum.title,
      description: forum.description,
      moduleItemId: item?.id ?? null,
      isPublished: item?.isPublished ?? false,
      topicCount: forum.topics.length,
      postCount: forum.topics.reduce((n, t) => n + t._count.posts, 0),
      lastActivityAt: lastActivity?.toISOString() ?? null,
      courseId: course.id,
      courseSlug: course.slug,
      moduleName: item?.module.name ?? null,
    };
  }

  /** Tạo diễn đàn kèm ModuleItem — như mọi hoạt động khác trong chương. */
  /**
   * Diễn đàn MẪU trong ngân hàng nội dung — đường đọc riêng.
   *
   * `getForum` không dùng được: nó kiểm ghi danh vào lớp và trả kèm slug khoá
   * học, mà bản mẫu không thuộc lớp nào. Ở đây chỉ có tên và mô tả, đúng những
   * gì chép về lớp sẽ mang theo (chủ đề thảo luận là của riêng từng lớp).
   */
  async getBankForum(
    user: AuthUser,
    forumId: string
  ): Promise<{ id: string; bankCategoryId: string; title: string; description: string | null }> {
    const forum = await this.prisma.forum.findUnique({
      where: { id: forumId },
      select: { id: true, bankCategoryId: true, title: true, description: true },
    });
    if (!forum?.bankCategoryId) throw new NotFoundException('Diễn đàn không tồn tại');
    await this.assertCanManageForums(user, null, forum.bankCategoryId);
    return { ...forum, bankCategoryId: forum.bankCategoryId };
  }

  async createForum(user: AuthUser, body: CreateForumBody): Promise<{ id: string }> {
    await this.assertCanManageForums(user, body.courseId);

    const mod = await this.prisma.module.findFirst({
      where: { id: body.moduleId, courseId: body.courseId },
      select: { id: true },
    });
    if (!mod) throw new NotFoundException('Chương không tồn tại trong khoá học này');

    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId: body.moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const forum = await this.prisma.$transaction(async (tx) => {
      const f = await tx.forum.create({
        data: {
          courseId: body.courseId,
          title: body.title.trim(),
          description: body.description?.trim() || null,
        },
      });
      await tx.moduleItem.create({
        data: {
          moduleId: body.moduleId,
          type: 'FORUM',
          position: (last?.position ?? -1) + 1,
          title: f.title,
          forumId: f.id,
        },
      });
      return f;
    });

    await this.invalidateCourseCaches(body.courseId);
    return { id: forum.id };
  }

  async updateForum(user: AuthUser, forumId: string, body: UpdateForumBody): Promise<void> {
    const forum = await this.prisma.forum.findUnique({
      where: { id: forumId },
      select: { courseId: true, bankCategoryId: true },
    });
    if (!forum) throw new NotFoundException('Diễn đàn không tồn tại');
    await this.assertCanManageForums(user, forum.courseId, forum.bankCategoryId);

    await this.prisma.$transaction(async (tx) => {
      await tx.forum.update({
        where: { id: forumId },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.description !== undefined && { description: body.description?.trim() || null }),
        },
      });
      // Tên hiển thị ở trang Chương là bản sao — đồng bộ lại.
      if (body.title !== undefined) {
        await tx.moduleItem.updateMany({
          where: { forumId },
          data: { title: body.title.trim() },
        });
      }
    });

    await this.invalidateCourseCaches(forum.courseId);
  }

  // ── Internals ──────────────────────────────────────────────────

  /**
   * `bankCategoryId` chỉ được truyền khi SOẠN diễn đàn mẫu trong ngân hàng nội
   * dung. Bỏ trống thì bản mẫu bị từ chối — mọi nghiệp vụ thảo luận (đăng chủ
   * đề, trả lời, ghi danh) đều gắn với một lớp thật.
   */
  private async canManageForums(
    user: AuthUser,
    courseId: string | null,
    bankCategoryId: string | null = null
  ): Promise<boolean> {
    if (!hasMinRole(user.role, 'TEACHER')) return false;
    return canManageActivity(this.prisma, user, { courseId, bankCategoryId });
  }

  private async assertCanManageForums(
    user: AuthUser,
    courseId: string | null,
    bankCategoryId: string | null = null
  ): Promise<void> {
    if (!(await this.canManageForums(user, courseId, bankCategoryId)))
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
  }

  /** Danh sách chủ đề được cache ở hai key: theo khoá và theo từng diễn đàn. */
  private async invalidateTopicLists(courseId: string, forumId: string | null): Promise<void> {
    await Promise.allSettled([
      this.cache.del(`forum:topics:${courseId}`),
      ...(forumId ? [this.cache.del(`forum:topics:${courseId}:${forumId}`)] : []),
    ]);
  }

  /** Diễn đàn hiện trong cây chương nên cache modules cũng phải bỏ. */
  private async invalidateCourseCaches(courseId: string | null): Promise<void> {
    if (!courseId) return;
    await Promise.allSettled([
      this.cache.del(`forum:topics:${courseId}`),
      this.cache.del(`modules:${courseId}`),
      this.cache.del(`modules:pub:${courseId}`),
      this.cache.del(`modules:nav:${courseId}`),
      this.cache.del(`modules:nav:pub:${courseId}`),
    ]);
  }

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
