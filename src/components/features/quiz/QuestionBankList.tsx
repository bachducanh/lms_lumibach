'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { DeleteQuestionButton } from '@/components/features/quiz/DeleteQuestionButton';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, Pencil, Plus,
  CheckCircle2, Circle, FolderOpen, HelpCircle, Trash2, Check, X,
} from 'lucide-react';
import {
  createCategoryAction, updateCategoryAction, deleteCategoryAction,
  type QuestionItem, type CategoryWithQuestions,
} from '@/actions/questions';
// QuestionType extended beyond Prisma enum — use string

const TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE:   'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  MULTIPLE_CHOICE_MULTIPLE: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  TRUE_FALSE:               'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  TRUE_FALSE_MULTI:         'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  ESSAY:                    'bg-green-500/10 text-green-700 dark:text-green-400',
  CODE_PYTHON:              'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  CODE_CPP:                 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  CODE_WEB:                 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};
const TYPE_SHORT: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE:   'TN-1',
  MULTIPLE_CHOICE_MULTIPLE: 'TN-N',
  TRUE_FALSE:               'Đ/S',
  TRUE_FALSE_MULTI:         'Đ/S+',
  ESSAY:                    'TL',
  CODE_PYTHON:              'PY',
  CODE_CPP:                 'C++',
  CODE_WEB:                 'Web',
};

// ── Question row ─────────────────────────────────────────────

function QuestionRow({ q, courseSlug, canManage }: { q: QuestionItem; courseSlug: string; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_BADGE[q.type])}>
          {TYPE_SHORT[q.type]}
        </span>
        <p className="flex-1 min-w-0 text-sm line-clamp-1">{q.content}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{q.points}đ</span>
          {canManage && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/courses/${courseSlug}/questions/${q.id}/edit`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-muted-foreground/40 hover:text-foreground')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <DeleteQuestionButton questionId={q.id} />
            </div>
          )}
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          }
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
          <p className="text-sm">{q.content}</p>
          {q.options.length > 0 && (
            <div className="space-y-1.5">
              {q.options.map((opt) => (
                <div key={opt.id} className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs',
                  opt.isCorrect
                    ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                    : 'border-border bg-background text-muted-foreground',
                )}>
                  {opt.isCorrect
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    : <Circle className="h-3.5 w-3.5 shrink-0 opacity-30" />
                  }
                  {opt.content}
                  {opt.isCorrect && <span className="ml-auto font-medium">Đúng</span>}
                </div>
              ))}
            </div>
          )}
          {q.explanation && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Giải thích: </span>{q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category section ─────────────────────────────────────────

function CategorySection({
  category, courseSlug, canManage, defaultOpen,
}: {
  category:    CategoryWithQuestions;
  courseSlug:  string;
  canManage:   boolean;
  defaultOpen: boolean;
}) {
  const router = useRouter();
  const [open,    setOpen]    = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(category.name);
  const [pending, setPending] = useState(false);

  async function handleRename() {
    if (name.trim() === category.name) { setEditing(false); return; }
    setPending(true);
    const res = await updateCategoryAction(category.id, name);
    setPending(false);
    if (res.success) { toast.success(res.message); router.refresh(); setEditing(false); }
    else toast.error(res.error);
  }

  async function handleDelete() {
    if (!confirm(`Xoá danh mục "${category.name}"? Các câu hỏi sẽ không bị xoá nhưng sẽ mất phân loại.`)) return;
    setPending(true);
    const res = await deleteCategoryAction(category.id);
    setPending(false);
    if (res.success) { toast.success(res.message); router.refresh(); }
    else toast.error(res.error);
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 bg-card hover:bg-accent/20 transition-colors">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <FolderOpen className="h-4 w-4" />
          </div>
          {editing ? (
            <span className="flex-1" />
          ) : (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{category.name}</p>
              <p className="text-xs text-muted-foreground">{category.questions.length} câu hỏi</p>
            </div>
          )}
          {!editing && (open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          )}
        </button>

        {/* Inline rename */}
        {canManage && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditing(false); setName(category.name); } }}
                  className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-48"
                  disabled={pending}
                />
                <button onClick={handleRename} disabled={pending} className="p-1 rounded hover:bg-accent text-green-600">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setEditing(false); setName(category.name); }} className="p-1 rounded hover:bg-accent text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleDelete} disabled={pending} className="p-1.5 rounded hover:bg-accent text-muted-foreground/50 hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-border bg-muted/5 px-4 py-3 space-y-2">
          {category.questions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">Chưa có câu hỏi trong danh mục này.</p>
          ) : (
            category.questions.map((q) => (
              <QuestionRow key={q.id} q={q} courseSlug={courseSlug} canManage={canManage} />
            ))
          )}

          {canManage && (
            <Link
              href={`/courses/${courseSlug}/questions/new?categoryId=${category.id}`}
              className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/30 transition-all"
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
  const [open,    setOpen]    = useState(false);
  const [name,    setName]    = useState('');
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setPending(true);
    const res = await createCategoryAction(courseId, name);
    setPending(false);
    if (res.success) { toast.success(res.message); setName(''); setOpen(false); onCreated(); }
    else toast.error(res.error);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/20 transition-all"
      >
        <Plus className="h-4 w-4" />
        Tạo danh mục mới
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-accent/10 px-4 py-3">
      <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
      <input
        autoFocus
        placeholder="Tên danh mục..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setOpen(false); setName(''); } }}
        className="flex-1 bg-transparent text-sm focus:outline-none"
        disabled={pending}
      />
      <button onClick={handleCreate} disabled={pending || !name.trim()} className="rounded px-3 py-1 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
        Tạo
      </button>
      <button onClick={() => { setOpen(false); setName(''); }} className="text-muted-foreground hover:text-foreground p-1 rounded">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

type Props = {
  categories:    CategoryWithQuestions[];
  uncategorized: QuestionItem[];
  courseId:      string;
  courseSlug:    string;
  canManage:     boolean;
};

export function QuestionBankList({ categories, uncategorized, courseId, courseSlug, canManage }: Props) {
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
        <div className="rounded-2xl border border-dashed border-border overflow-hidden">
          <div className="px-5 py-3.5 bg-muted/10">
            <p className="text-sm font-medium text-muted-foreground">Chưa phân danh mục ({uncategorized.length} câu)</p>
          </div>
          <div className="border-t border-border bg-muted/5 px-4 py-3 space-y-2">
            {uncategorized.map((q) => (
              <QuestionRow key={q.id} q={q} courseSlug={courseSlug} canManage={canManage} />
            ))}
          </div>
        </div>
      )}

      {/* Create category */}
      {canManage && (
        <NewCategoryForm courseId={courseId} onCreated={() => router.refresh()} />
      )}

      {/* Empty state */}
      {categories.length === 0 && uncategorized.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <HelpCircle className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">Chưa có câu hỏi nào</p>
          <p className="text-xs text-muted-foreground mt-1">Tạo danh mục trước, sau đó thêm câu hỏi vào.</p>
        </div>
      )}
    </div>
  );
}
