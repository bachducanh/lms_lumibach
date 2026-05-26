import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { ForumTopicSummary, CourseDetail } from '@lumibach/types';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasMinRole } from '@/lib/permissions';
import { MessageSquare, Pin, Lock, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
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

export default async function ForumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const topics = await api
    .get<ForumTopicSummary[]>('/forum/topics', { query: { courseId: course.id } })
    .catch((err: unknown) => {
      if (err instanceof ApiError) return [] as ForumTopicSummary[];
      throw err;
    });

  const canManage = hasMinRole(role, 'TEACHER');

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {course.name}
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-sky-400" />
          <h1 className="text-xl font-bold">Diễn đàn</h1>
        </div>
        <Link href={`/courses/${slug}/forum/new`} className={buttonVariants({ size: 'sm' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tạo chủ đề mới
        </Link>
      </div>

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <MessageSquare className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Chưa có chủ đề nào. Hãy bắt đầu cuộc trò chuyện!
          </p>
          <Link
            href={`/courses/${slug}/forum/new`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
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
                {/* Icon */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <MessageSquare className="h-4.5 w-4.5 text-sky-400" />
                </div>

                {/* Content */}
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

                {/* Stats */}
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
          Bạn là giáo viên — có thể ghim, khoá và xoá chủ đề trong trang chi tiết.
        </p>
      )}
    </div>
  );
}
