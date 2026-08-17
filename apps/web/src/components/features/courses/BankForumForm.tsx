'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { bankContentHref } from '@/lib/activity-owner';

/**
 * Trình soạn diễn đàn MẪU trong kho nội dung.
 *
 * Chỉ có tên và mô tả — đúng những gì thao tác chép về lớp mang theo. Chủ đề
 * thảo luận là của riêng từng lớp nên không có gì để soạn ở kho, và cũng vì thế
 * mà diễn đàn không dùng chung màn hình với trang diễn đàn của khoá học.
 */
export function BankForumForm({
  categoryId,
  forum,
}: {
  categoryId: string;
  forum: { id: string; title: string; description: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(forum.title);
  const [description, setDescription] = useState(forum.description ?? '');

  function luu() {
    const ten = title.trim();
    if (ten.length < 3) {
      toast.error('Tên diễn đàn tối thiểu 3 ký tự.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/forum/forums/${forum.id}`, {
          title: ten,
          description: description.trim() || null,
        });
        toast.success('Đã lưu bản mẫu trong kho.');
        router.push(bankContentHref(categoryId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không lưu được diễn đàn.');
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Tên diễn đàn *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Hỏi đáp Chủ đề A"
          className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Mô tả (tuỳ chọn)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Diễn đàn này dùng để làm gì, quy ước đặt câu hỏi…"
          className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        Bản mẫu chỉ giữ tên và mô tả. Khi một lớp chép diễn đàn này về, lớp đó bắt đầu với danh sách
        chủ đề trống — thảo luận là của riêng từng lớp.
      </p>

      <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(bankContentHref(categoryId))}
          disabled={pending}
        >
          Huỷ
        </Button>
        <Button type="button" onClick={luu} disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  );
}
