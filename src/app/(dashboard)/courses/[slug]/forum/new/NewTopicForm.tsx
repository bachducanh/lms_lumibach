'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTopicAction } from '@/actions/forum';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function NewTopicForm({ courseId, slug }: { courseId: string; slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTopicAction(courseId, { title, content });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã tạo chủ đề');
      router.push(`/courses/${slug}/forum/${result.data!.topicId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề chủ đề của bạn..."
            maxLength={200}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content">Nội dung</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Mô tả chi tiết câu hỏi hoặc chủ đề thảo luận..."
            rows={8}
            required
          />
          <p className="text-xs text-muted-foreground">Hỗ trợ định dạng văn bản thô</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Đang đăng...' : 'Đăng chủ đề'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
