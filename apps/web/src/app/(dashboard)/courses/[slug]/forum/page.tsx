import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { CourseForums, ForumTopicSummary, CourseDetail } from '@lumibach/types';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasMinRole } from '@/lib/permissions';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import {
  MessageSquare,
  MessagesSquare,
  Pin,
  Lock,
  Plus,
  ChevronRight,
  ArrowLeft,
  FolderOpen,
  EyeOff,
} from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: `Diễn đàn — ${course?.name ?? 'Khoá học'}` };
}

function authorName(u: { fullName?: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
}

function timeAgo(date: Date | string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(date).toLocaleDateString('vi-VN');
}

type ForumDetail = CourseForums['groups'][number]['forums'][number] & {
  courseId: string;
  courseSlug: string;
  moduleName: string | null;
};

/**
 * Tab Diễn đàn có hai chế độ trên cùng một route:
 *  - không có ?forumId : danh sách diễn đàn nhóm theo chương (như tab Bài tập)
 *  - có ?forumId       : danh sách chủ đề bên trong một diễn đàn
 * Giữ chung route để link chủ đề `/forum/<topicId>` trong thông báo cũ vẫn chạy.
 */
export default async function ForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ forumId?: string; legacy?: string }>;
}) {
  const { slug } = await params;
  const { forumId, legacy } = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = hasMinRole(role, 'TEACHER');

  if (forumId || legacy) {
    const forum = forumId
      ? await api.get<ForumDetail>(`/forum/forums/${forumId}`).catch(() => null)
      : null;
    if (forumId && !forum) notFound();

    const topics = await api
      .get<ForumTopicSummary[]>('/forum/topics', {
        query: { courseId: course.id, ...(forumId ? { forumId } : {}) },
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) return [] as ForumTopicSummary[];
        throw err;
      });

    // Chế độ "legacy" xem chủ đề cấp khoá — lọc phía web vì API trả cả hai loại.
    const visible = legacy && !forumId ? topics.filter((t) => !t.forumId) : topics;

    return (
      <TopicList
        slug={slug}
        title={forum?.title ?? 'Chủ đề chung của khoá học'}
        description={forum?.description ?? null}
        moduleName={forum?.moduleName ?? null}
        newTopicHref={`/courses/${slug}/forum/new${forumId ? `?forumId=${forumId}` : ''}`}
        topics={visible}
        canManage={canManage}
      />
    );
  }

  const data = await api.get<CourseForums>(`/forum/courses/${course.id}`).catch((err: unknown) => {
    if (err instanceof ApiError) return { groups: [], legacyTopicCount: 0 } as CourseForums;
    throw err;
  });

  const totalForums = data.groups.reduce((n, g) => n + g.forums.length, 0);

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.name}
      </Link>

      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-sky-400" />
        <h1 className="text-xl font-bold">Diễn đàn</h1>
      </div>

      {totalForums === 0 && data.legacyTopicCount === 0 ? (
        <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <MessagesSquare className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground text-sm">Khoá học chưa có diễn đàn nào.</p>
          {canManage && (
            <p className="text-muted-foreground/70 max-w-md text-xs">
              Diễn đàn là một hoạt động học tập: vào trang Chương, bấm “Thêm bài học / bài tập” rồi
              chọn <strong>Diễn đàn</strong> để tạo trong chương mong muốn.
            </p>
          )}
          {canManage && (
            <Link
              href={`/courses/${slug}/modules`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Tới trang Chương
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {data.groups.map((group) => (
            <section key={group.moduleId ?? 'none'} className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="text-muted-foreground h-4 w-4" />
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  {group.moduleName}
                </h2>
                <span className="text-muted-foreground text-xs">
                  {group.forums.length} diễn đàn
                </span>
              </div>

              <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
                {group.forums.map((forum) => (
                  <Link
                    key={forum.id}
                    href={`/courses/${slug}/forum?forumId=${forum.id}`}
                    className="hover:bg-accent/30 group flex items-start gap-4 px-5 py-4 transition-colors"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                      <MessagesSquare className="h-4.5 w-4.5 text-sky-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                          {forum.title}
                        </span>
                        {!forum.isPublished && (
                          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                            <EyeOff className="h-3 w-3" />
                            Chưa mở
                          </Badge>
                        )}
                      </div>
                      {forum.description && (
                        <RichTextView
                          html={forum.description}
                          className="text-muted-foreground mt-1 line-clamp-2 text-xs"
                        />
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {forum.topicCount} chủ đề ·{' '}
                        {Math.max(0, forum.postCount - forum.topicCount)} trả lời
                        {forum.lastActivityAt && <> · mới nhất {timeAgo(forum.lastActivityAt)}</>}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-2 h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {data.legacyTopicCount > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="text-muted-foreground h-4 w-4" />
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  Chủ đề chung của khoá học
                </h2>
              </div>
              <Link
                href={`/courses/${slug}/forum?legacy=1`}
                className="border-border bg-card hover:bg-accent/30 group flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                  <MessageSquare className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="group-hover:text-primary text-sm font-semibold transition-colors">
                    {data.legacyTopicCount} chủ đề chưa thuộc diễn đàn nào
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Tạo từ trước khi diễn đàn trở thành hoạt động trong chương.
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── Danh sách chủ đề trong một diễn đàn ────────────────────────

function TopicList({
  slug,
  title,
  description,
  moduleName,
  newTopicHref,
  topics,
  canManage,
}: {
  slug: string;
  title: string;
  description: string | null;
  moduleName: string | null;
  newTopicHref: string;
  topics: ForumTopicSummary[];
  canManage: boolean;
}) {
  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href={`/courses/${slug}/forum`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tất cả diễn đàn
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {moduleName && (
            <p className="text-muted-foreground text-xs tracking-wide uppercase">{moduleName}</p>
          )}
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 shrink-0 text-sky-400" />
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
          {description && (
            <RichTextView html={description} className="text-muted-foreground mt-2 text-sm" />
          )}
        </div>
        <Link href={newTopicHref} className={buttonVariants({ size: 'sm' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tạo chủ đề mới
        </Link>
      </div>

      {topics.length === 0 ? (
        <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <MessageSquare className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Chưa có chủ đề nào. Hãy bắt đầu cuộc trò chuyện!
          </p>
          <Link href={newTopicHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Tạo chủ đề đầu tiên
          </Link>
        </div>
      ) : (
        <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
          {topics.map((topic) => {
            const lastPost = topic.posts[0];
            const postCount = topic._count.posts;
            return (
              <Link
                key={topic.id}
                href={`/courses/${slug}/forum/${topic.id}`}
                className="hover:bg-accent/30 group flex items-start gap-4 px-5 py-4 transition-colors"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <MessageSquare className="h-4.5 w-4.5 text-sky-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {topic.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    {topic.isLocked && (
                      <Lock className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="group-hover:text-primary truncate text-sm leading-snug font-semibold transition-colors">
                      {topic.title}
                    </span>
                    {topic.isPinned && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-400/30 text-xs text-amber-400"
                      >
                        Ghim
                      </Badge>
                    )}
                    {topic.groupName && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {topic.groupName}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {authorName(topic.author)} &middot; {timeAgo(topic.createdAt)}
                    {lastPost && lastPost.createdAt > topic.createdAt && (
                      <>
                        {' · Trả lời cuối: '}
                        {authorName(lastPost.author)} {timeAgo(lastPost.createdAt)}
                      </>
                    )}
                  </p>
                </div>

                <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {Math.max(0, postCount - 1)}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {canManage && topics.length > 0 && (
        <p className="text-muted-foreground/60 text-center text-xs">
          Bạn là giáo viên — có thể sửa nội dung, ghim, khoá và xoá chủ đề trong trang chi tiết.
        </p>
      )}
    </div>
  );
}
