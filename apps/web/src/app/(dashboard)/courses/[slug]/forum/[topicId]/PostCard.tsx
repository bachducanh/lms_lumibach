'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAnswerAction, deletePostAction } from '@/actions/forum';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, Reply, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { ReplyForm } from './ReplyForm';

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
  return role === 'TEACHER'
    ? 'Giáo viên'
    : role === 'ADMIN'
      ? 'Admin'
      : role === 'TA'
        ? 'Trợ giảng'
        : null;
}

type PostWithReplies = {
  id: string;
  content: string;
  isAnswer: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    fullName?: string | null;
    firstName: string;
    lastName: string;
    avatar?: string | null;
    role: string;
  };
  replies: Array<{
    id: string;
    content: string;
    isAnswer: boolean;
    createdAt: Date;
    updatedAt: Date;
    authorId: string;
    author: {
      id: string;
      fullName?: string | null;
      firstName: string;
      lastName: string;
      avatar?: string | null;
      role: string;
    };
  }>;
};

export function PostCard({
  post,
  currentUserId,
  canManage,
  slug,
  topicId,
}: {
  post: PostWithReplies;
  currentUserId: string;
  canManage: boolean;
  slug: string;
  topicId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showReply, setShowReply] = useState(false);

  const canDelete = canManage || post.authorId === currentUserId;

  function handleMarkAnswer() {
    startTransition(async () => {
      const result = await markAnswerAction(post.id, !post.isAnswer);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Xoá bài này?')) return;
    startTransition(async () => {
      const result = await deletePostAction(post.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã xoá bài');
      router.refresh();
    });
  }

  return (
    <div
      className={`bg-card overflow-hidden rounded-xl border ${post.isAnswer ? 'border-emerald-500/40' : 'border-border'}`}
    >
      {post.isAnswer && (
        <div className="flex items-center gap-1.5 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Câu trả lời được chấp nhận</span>
        </div>
      )}

      <div className="flex gap-4 p-5">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold">
            {post.author.avatar ? (
              <img
                src={post.author.avatar}
                alt={authorName(post.author)}
                className="h-full w-full object-cover"
              />
            ) : (
              authorName(post.author).charAt(0).toUpperCase()
            )}
          </div>
          {roleLabel(post.author.role) && (
            <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap">
              {roleLabel(post.author.role)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{authorName(post.author)}</p>
            <span className="text-muted-foreground text-xs">{timeAgo(post.createdAt)}</span>
          </div>

          <pre className="text-foreground/90 font-sans text-sm leading-relaxed whitespace-pre-wrap">
            {post.content}
          </pre>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 text-xs"
              onClick={() => setShowReply(!showReply)}
            >
              <Reply className="mr-1 h-3.5 w-3.5" />
              Trả lời
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 text-xs ${post.isAnswer ? 'text-emerald-400 hover:text-emerald-300' : 'text-muted-foreground hover:text-emerald-400'}`}
                onClick={handleMarkAnswer}
                disabled={isPending}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {post.isAnswer ? 'Bỏ chấp nhận' : 'Chấp nhận'}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive ml-auto h-7 text-xs"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Inline reply form */}
          {showReply && (
            <div className="mt-2">
              <ReplyForm
                topicId={topicId}
                slug={slug}
                parentId={post.id}
                onDone={() => setShowReply(false)}
              />
            </div>
          )}

          {/* Nested replies */}
          {post.replies.length > 0 && (
            <div className="border-border mt-3 space-y-3 border-l-2 pl-3">
              {post.replies.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <CornerDownRight className="text-muted-foreground/40 mt-1 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{authorName(reply.author)}</span>
                      {roleLabel(reply.author.role) && (
                        <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px]">
                          {roleLabel(reply.author.role)}
                        </span>
                      )}
                      <span className="text-muted-foreground ml-auto text-xs">
                        {timeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <pre className="text-foreground/80 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                      {reply.content}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
