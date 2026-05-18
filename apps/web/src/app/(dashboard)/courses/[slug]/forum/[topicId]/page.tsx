import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { ForumTopicDetail } from '@lumibach/types';
import { hasMinRole } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pin, Lock, Eye, MessageSquare } from 'lucide-react';
import { TopicControls } from './TopicControls';
import { ReplyForm } from './ReplyForm';
import { PostCard } from './PostCard';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; topicId: string }>;
}) {
  const { topicId } = await params;
  const api = apiServerClient(await cookies());
  const topic = await api.get<ForumTopicDetail>(`/forum/topics/${topicId}`).catch(() => null);
  return { title: topic?.title ?? 'Chủ đề' };
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

function authorName(u: { fullName?: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
}

function roleLabel(role: string) {
  return role === 'TEACHER'
    ? 'Giáo viên'
    : role === 'ADMIN'
      ? 'Admin'
      : role === 'TA'
        ? 'Trợ giảng'
        : null;
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string; topicId: string }>;
}) {
  const { slug, topicId } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const api = apiServerClient(await cookies());
  const topic = await api
    .get<ForumTopicDetail>(`/forum/topics/${topicId}`)
    .catch((err: unknown) => {
      if (err instanceof ApiError) return null;
      throw err;
    });
  if (!topic) notFound();

  const role = session.user.role as UserRole;
  const userId = session.user.id!;
  const canManage = hasMinRole(role, 'TEACHER');
  const canReply = !topic.isLocked || canManage;

  const [firstPost, ...replyPosts] = topic.posts;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}/forum`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Diễn đàn
        </Link>
      </div>

      {/* Topic header */}
      <div className="border-border bg-card space-y-3 rounded-xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {topic.isPinned && <Pin className="h-4 w-4 shrink-0 text-amber-400" />}
              {topic.isLocked && <Lock className="text-muted-foreground/60 h-4 w-4 shrink-0" />}
              <h1 className="text-lg leading-tight font-bold">{topic.title}</h1>
              {topic.isPinned && (
                <Badge variant="outline" className="border-amber-400/30 text-xs text-amber-400">
                  Ghim
                </Badge>
              )}
              {topic.isLocked && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-muted-foreground/30 text-xs"
                >
                  Đã khoá
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {topic.viewCount} lượt xem
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {Math.max(0, topic.posts.length - 1)} trả lời
              </span>
            </p>
          </div>
          {canManage && (
            <TopicControls
              topicId={topicId}
              slug={slug}
              isPinned={topic.isPinned}
              isLocked={topic.isLocked}
            />
          )}
        </div>
      </div>

      {/* Original post */}
      {firstPost && (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <div className="flex gap-4 p-5">
            {/* Avatar */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold">
                {firstPost.author.avatar ? (
                  <img
                    src={firstPost.author.avatar}
                    alt={authorName(firstPost.author)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  authorName(firstPost.author).charAt(0).toUpperCase()
                )}
              </div>
              {roleLabel(firstPost.author.role) && (
                <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap">
                  {roleLabel(firstPost.author.role)}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{authorName(firstPost.author)}</p>
                <span className="text-muted-foreground text-xs">
                  {timeAgo(firstPost.createdAt)}
                </span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <pre className="text-foreground/90 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {firstPost.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replies */}
      {replyPosts.length > 0 && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {replyPosts.length} trả lời
          </p>
          <div className="space-y-3">
            {replyPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={userId}
                canManage={canManage}
                slug={slug}
                topicId={topicId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reply form */}
      {canReply ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Trả lời
          </p>
          <ReplyForm topicId={topicId} slug={slug} />
        </div>
      ) : (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-5 text-center text-sm">
          <Lock className="mx-auto mb-1.5 h-4 w-4 opacity-50" />
          Chủ đề đã bị khoá, không thể trả lời.
        </div>
      )}
    </div>
  );
}
