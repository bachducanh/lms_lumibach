import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getTopicAction } from '@/actions/forum';
import { hasMinRole } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pin, Lock, CheckCircle2, Eye, MessageSquare } from 'lucide-react';
import { TopicControls } from './TopicControls';
import { ReplyForm } from './ReplyForm';
import { PostCard } from './PostCard';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string; topicId: string }> }) {
  const { topicId } = await params;
  const topic = await getTopicAction(topicId);
  return { title: topic?.title ?? 'Chủ đề' };
}

function timeAgo(date: Date) {
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
  return role === 'TEACHER' ? 'Giáo viên' : role === 'ADMIN' ? 'Admin' : role === 'TA' ? 'Trợ giảng' : null;
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ slug: string; topicId: string }>;
}) {
  const { slug, topicId } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const topic = await getTopicAction(topicId);
  if (!topic) notFound();

  const role = session.user.role as UserRole;
  const userId = session.user.id!;
  const canManage = hasMinRole(role, 'TEACHER');
  const canReply = !topic.isLocked || canManage;

  // Separate first post (original post) from replies
  const [firstPost, ...replyPosts] = topic.posts;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}/forum`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Diễn đàn
        </Link>
      </div>

      {/* Topic header */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {topic.isPinned && <Pin className="h-4 w-4 text-amber-400 shrink-0" />}
              {topic.isLocked && <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
              <h1 className="text-lg font-bold leading-tight">{topic.title}</h1>
              {topic.isPinned && (
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">Ghim</Badge>
              )}
              {topic.isLocked && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Đã khoá</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-3">
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex gap-4 p-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="h-9 w-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {firstPost.author.avatar
                  ? <img src={firstPost.author.avatar} alt={authorName(firstPost.author)} className="h-full w-full object-cover" />
                  : authorName(firstPost.author).charAt(0).toUpperCase()
                }
              </div>
              {roleLabel(firstPost.author.role) && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                  {roleLabel(firstPost.author.role)}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{authorName(firstPost.author)}</p>
                <span className="text-xs text-muted-foreground">{timeAgo(firstPost.createdAt)}</span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trả lời</p>
          <ReplyForm topicId={topicId} slug={slug} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          <Lock className="h-4 w-4 mx-auto mb-1.5 opacity-50" />
          Chủ đề đã bị khoá, không thể trả lời.
        </div>
      )}
    </div>
  );
}
