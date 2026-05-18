'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { DeleteQuestionButton } from '@/components/features/quiz/DeleteQuestionButton';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  CheckCircle2,
  Circle,
  FolderOpen,
  HelpCircle,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { QuestionItem, CategoryWithQuestions } from '@lumibach/types';
// QuestionType extended beyond Prisma enum — use string

import {
  QUESTION_TYPE_BADGE as TYPE_BADGE,
  QUESTION_TYPE_SHORT as TYPE_SHORT,
  QUESTION_TYPE_ICON as TYPE_ICON,
} from '@/lib/question-type-labels';

// ── Question row ─────────────────────────────────────────────

function QuestionRow({
  q,
  courseSlug,
  canManage,
}: {
  q: QuestionItem;
  courseSlug: string;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_ICON[q.type];

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
          {TypeIcon && <TypeIcon className="h-3 w-3" />}
          {TYPE_SHORT[q.type]}
        </span>
        <p className="line-clamp-1 min-w-0 flex-1 text-sm">{q.content}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground text-xs">{q.points}đ</span>
          {canManage && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/courses/${courseSlug}/questions/${q.id}/edit`}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                  'text-muted-foreground/40 hover:text-foreground'
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <DeleteQuestionButton questionId={q.id} />
            </div>
          )}
          {expanded ? (
            <ChevronDown className="text-muted-foreground/40 h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground/40 h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-border bg-muted/20 space-y-3 border-t px-5 py-4">
          <p className="text-sm">{q.content}</p>
          {q.options.length > 0 && (
            <div className="space-y-1.5">
              {q.options.map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs',
                    opt.isCorrect
                      ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                      : 'border-border bg-background text-muted-foreground'
                  )}
                >
                  {opt.isCorrect ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 opacity-30" />
                  )}
                  {opt.content}
                  {opt.isCorrect && <span className="ml-auto font-medium">Đúng</span>}
                </div>
              ))}
            </div>
          )}
          {q.explanation && (
            <div className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-xs">
              <span className="font-medium">Giải thích: </span>
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category section ─────────────────────────────────────────

function CategorySection({
  category,
  courseSlug,
  canManage,
  defaultOpen,
}: {
  category: CategoryWithQuestions;
  courseSlug: string;
  canManage: boolean;
  defaultOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [pending, setPending] = useState(false);

  async function handleRename() {
    if (name.trim() === category.name) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      await apiClient.patch(`/questions/categories/${category.id}`, { name });
      toast.success('Đã đổi tên danh mục.');
      router.refresh();
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Xoá danh mục "${category.name}"? Các câu hỏi sẽ không bị xoá nhưng sẽ mất phân loại.`
      )
    )
      return;
    setPending(true);
    try {
      await apiClient.delete(`/questions/categories/${category.id}`);
      toast.success('Đã xoá danh mục.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      {/* Header */}
      <div className="bg-card hover:bg-accent/20 flex items-center gap-2 px-5 py-3.5 transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <FolderOpen className="h-4 w-4" />
          </div>
          {editing ? (
            <span className="flex-1" />
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{category.name}</p>
              <p className="text-muted-foreground text-xs">{category.questions.length} câu hỏi</p>
            </div>
          )}
          {!editing &&
            (open ? (
              <ChevronDown className="text-muted-foreground/60 h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0" />
            ))}
        </button>

        {/* Inline rename */}
        {canManage && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') {
                      setEditing(false);
                      setName(category.name);
                    }
                  }}
                  className="border-input bg-background focus:ring-ring w-48 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
                  disabled={pending}
                />
                <button
                  onClick={handleRename}
                  disabled={pending}
                  className="hover:bg-accent rounded p-1 text-green-600"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setName(category.name);
                  }}
                  className="hover:bg-accent text-muted-foreground rounded p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="hover:bg-accent text-muted-foreground/50 hover:text-foreground rounded p-1.5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={pending}
                  className="hover:bg-accent text-muted-foreground/50 hover:text-destructive rounded p-1.5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-border bg-muted/5 space-y-2 border-t px-4 py-3">
          {category.questions.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-xs">
              Chưa có câu hỏi trong danh mục này.
            </p>
          ) : (
            category.questions.map((q) => (
              <QuestionRow key={q.id} q={q} courseSlug={courseSlug} canManage={canManage} />
            ))
          )}

          {canManage && (
            <Link
              href={`/courses/${courseSlug}/questions/new?categoryId=${category.id}`}
              className="border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/30 flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm câu hỏi vào danh mục này
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── New category inline form ──────────────────────────────────

function NewCategoryForm({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setPending(true);
    try {
      await apiClient.post('/questions/categories', { courseId, name });
      toast.success('Đã tạo danh mục.');
      setName('');
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/20 flex w-full items-center gap-2 rounded-xl border border-dashed px-5 py-3 text-sm transition-all"
      >
        <Plus className="h-4 w-4" />
        Tạo danh mục mới
      </button>
    );
  }

  return (
    <div className="border-primary/40 bg-accent/10 flex items-center gap-2 rounded-xl border px-4 py-3">
      <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
      <input
        autoFocus
        placeholder="Tên danh mục..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') {
            setOpen(false);
            setName('');
          }
        }}
        className="flex-1 bg-transparent text-sm focus:outline-none"
        disabled={pending}
      />
      <button
        onClick={handleCreate}
        disabled={pending || !name.trim()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
      >
        Tạo
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setName('');
        }}
        className="text-muted-foreground hover:text-foreground rounded p-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

type Props = {
  categories: CategoryWithQuestions[];
  uncategorized: QuestionItem[];
  courseId: string;
  courseSlug: string;
  canManage: boolean;
};

export function QuestionBankList({
  categories,
  uncategorized,
  courseId,
  courseSlug,
  canManage,
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {categories.map((cat, i) => (
        <CategorySection
          key={cat.id}
          category={cat}
          courseSlug={courseSlug}
          canManage={canManage}
          defaultOpen={i === 0}
        />
      ))}

      {/* Uncategorized */}
      {uncategorized.length > 0 && (
        <div className="border-border overflow-hidden rounded-2xl border border-dashed">
          <div className="bg-muted/10 px-5 py-3.5">
            <p className="text-muted-foreground text-sm font-medium">
              Chưa phân danh mục ({uncategorized.length} câu)
            </p>
          </div>
          <div className="border-border bg-muted/5 space-y-2 border-t px-4 py-3">
            {uncategorized.map((q) => (
              <QuestionRow key={q.id} q={q} courseSlug={courseSlug} canManage={canManage} />
            ))}
          </div>
        </div>
      )}

      {/* Create category */}
      {canManage && <NewCategoryForm courseId={courseId} onCreated={() => router.refresh()} />}

      {/* Empty state */}
      {categories.length === 0 && uncategorized.length === 0 && (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <HelpCircle className="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p className="font-medium">Chưa có câu hỏi nào</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Tạo danh mục trước, sau đó thêm câu hỏi vào.
          </p>
        </div>
      )}
    </div>
  );
}
