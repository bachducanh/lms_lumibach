'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BookOpen, Check, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CategoryBankModule, CategoryContentBankData } from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';

function loiCua(err: unknown, macDinh: string) {
  return err instanceof ApiError ? err.message : macDinh;
}

function ModuleBlock({ mod, categoryId }: { mod: CategoryBankModule; categoryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(mod.name);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function luuTen() {
    const ten = name.trim();
    if (!ten || ten === mod.name) {
      setEditing(false);
      setName(mod.name);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/bank-modules/${mod.id}`, { name: ten });
        toast.success('Đã đổi tên chương.');
        setEditing(false);
        router.refresh();
      } catch (err) {
        setName(mod.name);
        toast.error(loiCua(err, 'Không đổi được tên chương.'));
      }
    });
  }

  function xoaChuong() {
    startTransition(async () => {
      const ok = await openConfirm(
        `Xoá chương “${mod.name}”? ${mod.items.length} hoạt động bên trong sẽ bị xoá theo — khác với thư mục câu hỏi, hoạt động không có chỗ nào khác để giữ lại. Các bản đã chép về khoá học vẫn còn nguyên.`
      );
      if (!ok) return;
      try {
        const res = await apiClient.delete<{ message?: string }>(`/modules/bank-modules/${mod.id}`);
        toast.success(res?.message || 'Đã xoá chương.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được chương.'));
      }
    });
  }

  function xoaHoatDong(itemId: string, title: string) {
    startTransition(async () => {
      const ok = await openConfirm(`Xoá “${title}” khỏi kho?`);
      if (!ok) return;
      try {
        await apiClient.delete(`/modules/bank-items/${itemId}`);
        toast.success('Đã xoá hoạt động khỏi kho.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được hoạt động.'));
      }
    });
  }

  return (
    <section className="space-y-2">
      {confirmDialog}
      <header className="flex flex-wrap items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') luuTen();
                if (e.key === 'Escape') {
                  setName(mod.name);
                  setEditing(false);
                }
              }}
              className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            />
            <button type="button" onClick={luuTen} disabled={pending} className="text-emerald-600">
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(mod.name);
                setEditing(false);
              }}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{mod.name}</h2>
            <span className="text-muted-foreground text-xs">{mod.items.length} hoạt động</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground/40 hover:text-foreground"
              aria-label="Đổi tên chương"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoaChuong}
              disabled={pending}
              className="text-muted-foreground/40 hover:text-destructive disabled:opacity-50"
              aria-label="Xoá chương"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <Link
          href={`/question-banks/${categoryId}/content/lessons/new?module=${mod.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-auto text-xs')}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Thêm bài giảng
        </Link>
      </header>

      {mod.items.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-4 text-xs">
          Chương trống.
        </p>
      ) : (
        <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
          {mod.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <BookOpen className="text-muted-foreground/50 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.detail && <p className="text-muted-foreground text-xs">{item.detail}</p>}
              </div>
              {item.lessonId && (
                <Link
                  href={`/question-banks/${categoryId}/content/lessons/${item.lessonId}/edit?module=${mod.id}`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'text-muted-foreground/40 hover:text-foreground'
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => xoaHoatDong(item.id, item.title)}
                disabled={pending}
                className="text-muted-foreground/40 hover:text-destructive p-1.5 disabled:opacity-50"
                aria-label="Xoá hoạt động"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CategoryContentBankManager({ data }: { data: CategoryContentBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const tongHoatDong = data.modules.reduce((s, m) => s + m.items.length, 0);

  function themChuong() {
    const ten = newName.trim();
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/bank-categories/${data.categoryId}/modules`, { name: ten });
        toast.success('Đã thêm chương.');
        setNewName('');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được chương.'));
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="border-border bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {data.modules.length} chương · {tongHoatDong} hoạt động. Mọi khoá học thuộc nhánh{' '}
          <span className="text-foreground font-medium">{data.categoryPath}</span> đều thấy kho này
          ở trang “Ngân hàng nội dung” và chép về được.
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FolderPlus className="mr-1.5 h-4 w-4" />
          Thêm chương
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') themChuong();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tên chương, ví dụ “Chủ đề A — Máy tính và xã hội tri thức”"
            className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="button"
            onClick={themChuong}
            disabled={pending || !newName.trim()}
            className={buttonVariants({ size: 'sm' })}
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Huỷ
          </button>
        </div>
      )}

      {data.modules.map((m) => (
        <ModuleBlock key={m.id} mod={m} categoryId={data.categoryId} />
      ))}

      {data.modules.length === 0 && (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
          Kho nội dung này chưa có chương nào. Thêm một chương để bắt đầu soạn.
        </div>
      )}

      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        Hiện soạn thẳng ở đây được <span className="text-foreground font-medium">bài giảng</span>.
        Bài tập, quiz, bài code, đề luyện tập và diễn đàn vào kho bằng nút chia sẻ ở trang Chương
        của khoá học — chép về thì dùng như nhau.
      </p>
    </div>
  );
}
