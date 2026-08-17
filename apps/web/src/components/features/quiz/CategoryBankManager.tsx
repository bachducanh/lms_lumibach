'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CategoryQuestionBankData,
  CategoryWithQuestions,
  QuestionItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { DeleteQuestionButton } from '@/components/features/quiz/DeleteQuestionButton';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn, stripHtml } from '@/lib/utils';
import {
  QUESTION_TYPE_BADGE as TYPE_BADGE,
  QUESTION_TYPE_SHORT as TYPE_SHORT,
  QUESTION_TYPE_ICON as TYPE_ICON,
} from '@/lib/question-type-labels';

const XOA_CAU_HOI =
  'Xoá câu hỏi này khỏi ngân hàng? Các bản đã chép về khoá học vẫn giữ nguyên — chúng là bản sao riêng.';

function loiCua(err: unknown, mac_dinh: string) {
  return err instanceof ApiError ? err.message : mac_dinh;
}

// ── Một câu hỏi ───────────────────────────────────────────────

function QuestionRow({ q, categoryId }: { q: QuestionItem; categoryId: string }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[q.type];

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className="hover:bg-accent/30 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            TYPE_BADGE[q.type]
          )}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {TYPE_SHORT[q.type]}
        </span>
        <p className="line-clamp-1 min-w-0 flex-1 text-sm">{stripHtml(q.content)}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-xs">{q.points}đ</span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/question-banks/${categoryId}/questions/${q.id}/edit`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                'text-muted-foreground/40 hover:text-foreground'
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <DeleteQuestionButton questionId={q.id} confirmMessage={XOA_CAU_HOI} />
          </div>
          {expanded ? (
            <ChevronDown className="text-muted-foreground/40 h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground/40 h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-border bg-muted/20 border-t px-5 py-4">
          <RichTextView html={q.content} className="text-sm" />
          {q.options.length > 0 && (
            <ul className="mt-3 space-y-1">
              {q.options.map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    'text-sm',
                    o.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                  )}
                >
                  {o.isCorrect ? '✓' : '·'} {stripHtml(o.content)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Một thư mục ───────────────────────────────────────────────

function FolderBlock({
  folder,
  categoryId,
}: {
  folder: CategoryWithQuestions;
  categoryId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function luuTen() {
    const ten = name.trim();
    if (!ten || ten === folder.name) {
      setEditing(false);
      setName(folder.name);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/questions/bank-folders/${folder.id}`, { name: ten });
        toast.success('Đã đổi tên thư mục.');
        setEditing(false);
        router.refresh();
      } catch (err) {
        setName(folder.name);
        toast.error(loiCua(err, 'Không đổi được tên thư mục.'));
      }
    });
  }

  /**
   * Hỏi xác nhận NGOÀI `startTransition` — gói vào trong là khoá chết: React 19
   * chưa vẽ cập nhật bên trong một action async cho tới khi action kết thúc, mà
   * action lại đang chờ cú bấm trong hộp thoại chưa được vẽ. Nút im lặng không
   * phản hồi, không có lỗi nào để lần ra.
   */
  async function xoa() {
    const ok = await openConfirm(
      `Xoá thư mục “${folder.name}”? ${folder.questions.length} câu hỏi bên trong sẽ chuyển về nhóm chưa xếp thư mục, không bị xoá.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await apiClient.delete<{ message?: string }>(
          `/questions/bank-folders/${folder.id}`
        );
        toast.success(res?.message || 'Đã xoá thư mục.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được thư mục.'));
      }
    });
  }

  return (
    <section className="space-y-2">
      {confirmDialog}
      <header className="flex flex-wrap items-center gap-2">
        <FolderOpen className="text-primary h-4 w-4 shrink-0" />
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') luuTen();
                if (e.key === 'Escape') {
                  setName(folder.name);
                  setEditing(false);
                }
              }}
              className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            />
            <button
              type="button"
              onClick={luuTen}
              disabled={pending}
              className="text-emerald-600 disabled:opacity-50"
              aria-label="Lưu tên"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(folder.name);
                setEditing(false);
              }}
              className="text-muted-foreground"
              aria-label="Huỷ"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{folder.name}</h2>
            <span className="text-muted-foreground text-xs">{folder.questions.length} câu hỏi</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground/40 hover:text-foreground"
              aria-label="Đổi tên thư mục"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoa}
              disabled={pending}
              className="text-muted-foreground/40 hover:text-destructive disabled:opacity-50"
              aria-label="Xoá thư mục"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <Link
          href={`/question-banks/${categoryId}/questions/new?folder=${folder.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-auto text-xs')}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Thêm câu hỏi
        </Link>
      </header>

      {folder.questions.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-4 text-xs">
          Thư mục trống.
        </p>
      ) : (
        <div className="space-y-2">
          {folder.questions.map((q) => (
            <QuestionRow key={q.id} q={q} categoryId={categoryId} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Toàn bộ kho ───────────────────────────────────────────────

export function CategoryBankManager({ data }: { data: CategoryQuestionBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const tongCau =
    data.folders.reduce((s, f) => s + f.questions.length, 0) + data.uncategorized.length;

  function themThuMuc() {
    const ten = newName.trim();
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/questions/bank-categories/${data.categoryId}/folders`, {
          name: ten,
        });
        toast.success('Đã thêm thư mục.');
        setNewName('');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục.'));
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="border-border bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <HelpCircle className="text-muted-foreground h-4 w-4 shrink-0" />
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {data.folders.length} thư mục · {tongCau} câu hỏi. Mọi khoá học thuộc nhánh{' '}
          <span className="text-foreground font-medium">{data.categoryPath}</span> đều thấy kho này
          ở trang “Ngân hàng chung” và chép về được.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <FolderPlus className="mr-1.5 h-4 w-4" />
            Thêm thư mục
          </button>
          <Link
            href={`/question-banks/${data.categoryId}/questions/new`}
            className={buttonVariants({ size: 'sm' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Thêm câu hỏi
          </Link>
        </div>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') themThuMuc();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tên thư mục, ví dụ “Chương 1 — Thuật toán”"
            className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="button"
            onClick={themThuMuc}
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

      {data.folders.map((f) => (
        <FolderBlock key={f.id} folder={f} categoryId={data.categoryId} />
      ))}

      {data.uncategorized.length > 0 && (
        <section className="space-y-2">
          <header className="flex items-center gap-2">
            <FolderOpen className="text-muted-foreground h-4 w-4" />
            <h2 className="text-sm font-semibold">Chưa xếp thư mục</h2>
            <span className="text-muted-foreground text-xs">
              {data.uncategorized.length} câu hỏi
            </span>
          </header>
          <div className="space-y-2">
            {data.uncategorized.map((q) => (
              <QuestionRow key={q.id} q={q} categoryId={data.categoryId} />
            ))}
          </div>
        </section>
      )}

      {tongCau === 0 && data.folders.length === 0 && (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
          Kho này chưa có gì. Thêm thư mục để sắp xếp, hoặc thêm thẳng câu hỏi.
        </div>
      )}
    </div>
  );
}
