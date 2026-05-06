import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { listTopicsAction } from '@/actions/forum';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasMinRole } from '@/lib/permissions';
import { MessageSquare, Pin, Lock, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: `Diễn đàn — ${course?.name ?? 'Khoá học'}` };
}

function authorName(u: { fullName?: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
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

export default async function ForumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const topics = await listTopicsAction(course.id);

  const canManage = hasMinRole(role, 'TEACHER');

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
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
        <Link
          href={`/courses/${slug}/forum/new`}
          className={buttonVariants({ size: 'sm' })}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo chủ đề mới
        </Link>
      </div>

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center gap-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Chưa có chủ đề nào. Hãy bắt đầu cuộc trò chuyện!</p>
          <Link href={`/courses/${slug}/forum/new`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Tạo chủ đề đầu tiên
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {topics.map((topic) => {
            const lastPost = topic.posts[0];
            const postCount = topic._count.posts;
            return (
              <Link
                key={topic.id}
                href={`/courses/${slug}/forum/${topic.id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-accent/30 transition-colors group"
              >
                {/* Icon */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <MessageSquare className="h-4.5 w-4.5 text-sky-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {topic.isPinned && (
                      <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                    {topic.isLocked && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors truncate">
                      {topic.title}
                    </span>
                    {topic.isPinned && (
                      <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30 shrink-0">
                        Ghim
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {Math.max(0, postCount - 1)}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {canManage && topics.length > 0 && (
        <p className="text-xs text-muted-foreground/60 text-center">
          Bạn là giáo viên — có thể ghim, khoá và xoá chủ đề trong trang chi tiết.
        </p>
      )}
    </div>
  );
}
