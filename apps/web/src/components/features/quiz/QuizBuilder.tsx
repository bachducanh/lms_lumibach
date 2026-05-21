'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  GripVertical,
  HelpCircle,
  ChevronRight,
  FolderOpen,
  Shuffle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { QuizBankGroup } from '@lumibach/types';
import { cn, stripHtml } from '@/lib/utils';
import type { QuestionType } from '@lumibach/db';
import {
  QUESTION_TYPE_BADGE as TYPE_BADGE,
  QUESTION_TYPE_SHORT as TYPE_SHORT,
  QUESTION_TYPE_ICON as TYPE_ICON,
} from '@/lib/question-type-labels';

type QuizQItem = {
  id: string;
  questionId: string;
  position: number;
  points: number | null;
  question: {
    type: QuestionType;
    content: string;
    points: number;
  };
};

type Props = {
  quizId: string;
  courseSlug: string;
  initialItems: QuizQItem[];
  banks: QuizBankGroup[];
};

export function QuizBuilder({ quizId, courseSlug, initialItems, banks }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState<QuizQItem[]>(() =>
    [...initialItems].sort((a, b) => a.position - b.position)
  );
  const [pointInputs, setPointInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of initialItems) {
      map[item.questionId] = item.points != null ? String(item.points) : '';
    }
    return map;
  });
  const dragSrcIdx = useRef<number | null>(null);

  // Bank picker state — always start with no selection, user picks explicitly
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [randomCount, setRandomCount] = useState('5');

  const currentBank = banks.find((b) => b.id === selectedBankId) ?? null;
  // Filter bank questions that are already in the quiz
  const inQuizIds = new Set(items.map((i) => i.questionId));
  const bankQuestions = (currentBank?.questions ?? []).filter((q) => !inQuizIds.has(q.id));

  const totalPoints = items.reduce((sum, item) => {
    const override = pointInputs[item.questionId];
    const pts = override !== '' && override != null ? Number(override) : item.question.points;
    return sum + (isNaN(pts) ? 0 : pts);
  }, 0);

  function runAction(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
      router.refresh();
    });
  }

  function handleAddOne(q: QuizBankGroup['questions'][number]) {
    setItems((prev) => [
      ...prev,
      {
        id: '',
        questionId: q.id,
        position: prev.length,
        points: null,
        question: { type: q.type as QuestionType, content: q.content, points: q.points },
      },
    ]);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(q.id);
      return n;
    });
    setPointInputs((prev) => ({ ...prev, [q.id]: '' }));
    runAction(async () => {
      await apiClient.post(`/quizzes/${quizId}/questions`, { questionId: q.id });
    });
  }

  function handleRemove(questionId: string) {
    const removed = items.find((i) => i.questionId === questionId);
    if (!removed) return;
    setItems((prev) => prev.filter((i) => i.questionId !== questionId));
    setPointInputs((prev) => {
      const n = { ...prev };
      delete n[questionId];
      return n;
    });
    runAction(async () => {
      await apiClient.delete(`/quizzes/${quizId}/questions/${questionId}`);
    });
  }

  function handleDrop(dropIdx: number) {
    const srcIdx = dragSrcIdx.current;
    if (srcIdx === null || srcIdx === dropIdx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(srcIdx, 1);
    newItems.splice(dropIdx, 0, moved!);
    const reindexed = newItems.map((item, i) => ({ ...item, position: i }));
    setItems(reindexed);
    dragSrcIdx.current = null;
    runAction(async () => {
      await apiClient.patch(`/quizzes/${quizId}/questions/reorder`, {
        orderedIds: reindexed.map((i) => i.questionId),
      });
    });
  }

  function handlePointsBlur(questionId: string) {
    const raw = pointInputs[questionId] ?? '';
    const pts = raw === '' ? null : Number(raw);
    if (pts !== null && isNaN(pts)) return;
    const item = items.find((i) => i.questionId === questionId);
    if (!item?.id) return;
    runAction(async () => {
      await apiClient.patch(`/quizzes/quiz-questions/${item.id}/points`, { points: pts });
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleAddSelected() {
    const ids = [...selected].filter((id) => bankQuestions.some((q) => q.id === id));
    if (!ids.length) return;
    const toAdd = bankQuestions.filter((q) => ids.includes(q.id));
    setItems((prev) => [
      ...prev,
      ...toAdd.map((q, i) => ({
        id: '',
        questionId: q.id,
        position: prev.length + i,
        points: null,
        question: { type: q.type as QuestionType, content: q.content, points: q.points },
      })),
    ]);
    toAdd.forEach((q) => setPointInputs((prev) => ({ ...prev, [q.id]: '' })));
    setSelected(new Set());
    runAction(async () => {
      await apiClient.post(`/quizzes/${quizId}/questions`, { questionIds: ids });
    });
  }

  async function handleAddRandom() {
    const n = parseInt(randomCount, 10);
    if (!n || n < 1) return;
    if (pending) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/quizzes/${quizId}/questions`, {
          random: true,
          count: n,
          fromCategoryId: selectedBankId ?? undefined,
        });
        toast.success(`Đã thêm ngẫu nhiên.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Current questions ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Câu hỏi trong quiz ({items.length})</h2>
          {items.length > 0 && (
            <span className="text-muted-foreground text-xs">
              Tổng: <span className="text-foreground font-semibold">{totalPoints} điểm</span>
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
            <HelpCircle className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Chưa có câu hỏi nào — chọn từ ngân hàng bên dưới
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const effectivePoints =
                pointInputs[item.questionId] !== ''
                  ? Number(pointInputs[item.questionId] ?? 0)
                  : item.question.points;
              return (
                <div
                  key={item.questionId}
                  draggable
                  onDragStart={() => {
                    dragSrcIdx.current = idx;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className={cn(
                    'border-border bg-card flex cursor-default items-center gap-3 rounded-xl border px-4 py-3',
                    pending && 'opacity-60'
                  )}
                >
                  <GripVertical className="text-muted-foreground/40 h-4 w-4 shrink-0 cursor-grab active:cursor-grabbing" />
                  <span className="text-muted-foreground w-5 shrink-0 text-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      TYPE_BADGE[item.question.type]
                    )}
                  >
                    {(() => {
                      const I = TYPE_ICON[item.question.type];
                      return I ? <I className="h-3 w-3" /> : null;
                    })()}
                    {TYPE_SHORT[item.question.type]}
                  </span>
                  <p className="line-clamp-1 min-w-0 flex-1 text-sm">
                    {stripHtml(item.question.content)}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={pointInputs[item.questionId] ?? ''}
                      onChange={(e) =>
                        setPointInputs((prev) => ({ ...prev, [item.questionId]: e.target.value }))
                      }
                      onBlur={() => handlePointsBlur(item.questionId)}
                      placeholder={String(item.question.points)}
                      title="Điểm (để trống = mặc định)"
                      className="border-input bg-background focus:ring-ring w-16 rounded border px-2 py-1 text-center text-xs focus:ring-1 focus:outline-none"
                    />
                    <span className="text-muted-foreground text-xs">đ</span>
                    {pointInputs[item.questionId] === '' && (
                      <span className="text-muted-foreground/50 text-xs">({effectivePoints})</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(item.questionId)}
                    disabled={pending}
                    className="text-muted-foreground/40 hover:text-destructive shrink-0 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bank picker ───────────────────────────────────────── */}
      <div className="border-border bg-muted/10 space-y-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Danh mục câu hỏi</h2>
          <Link
            href={`/courses/${courseSlug}/questions/new?quizId=${quizId}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo câu hỏi mới
          </Link>
        </div>

        {/* Step 1 — pick a category */}
        {banks.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            Chưa có danh mục câu hỏi nào.{' '}
            <Link
              href={`/courses/${courseSlug}/questions`}
              className="text-primary hover:underline"
            >
              Tạo danh mục trong ngân hàng →
            </Link>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {banks.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => {
                    setSelectedBankId(bank.id);
                    setSelected(new Set());
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    selectedBankId === bank.id
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  {bank.title}
                  <span className="bg-muted rounded-full px-1.5 text-[10px]">
                    {bank.questions.filter((q) => !inQuizIds.has(q.id)).length}
                  </span>
                  {selectedBankId === bank.id && <ChevronRight className="h-3 w-3 opacity-60" />}
                </button>
              ))}
            </div>

            {/* Step 2 — questions from selected bank */}
            {currentBank && (
              <div className="space-y-2">
                {/* Action toolbar */}
                <div className="border-border bg-background flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
                  <Shuffle className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="text-muted-foreground shrink-0 text-xs">Ngẫu nhiên</span>
                  <input
                    type="number"
                    min={1}
                    max={bankQuestions.length || 1}
                    value={randomCount}
                    onChange={(e) => setRandomCount(e.target.value)}
                    className="border-input bg-background focus:ring-ring w-14 rounded border px-2 py-0.5 text-center text-xs focus:ring-1 focus:outline-none"
                  />
                  <span className="text-muted-foreground shrink-0 text-xs">câu</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddRandom}
                    disabled={pending || bankQuestions.length === 0}
                    className="h-7 text-xs"
                  >
                    Thêm ngẫu nhiên
                  </Button>
                  {selected.size > 0 && (
                    <>
                      <div className="bg-border mx-1 h-4 w-px" />
                      <Button
                        size="sm"
                        onClick={handleAddSelected}
                        disabled={pending}
                        className="h-7 text-xs"
                      >
                        Thêm {selected.size} câu đã chọn
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(new Set())}
                        className="h-7 px-2 text-xs"
                      >
                        Bỏ chọn
                      </Button>
                    </>
                  )}
                </div>

                {bankQuestions.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-center text-xs">
                    Tất cả câu hỏi trong quiz này đã được thêm vào.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                    {bankQuestions.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => toggleSelect(q.id)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors',
                          selected.has(q.id)
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-card hover:bg-accent/40'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                            selected.has(q.id)
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/30'
                          )}
                        >
                          {selected.has(q.id) && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                              <path
                                d="M1.5 5l2.5 2.5 4.5-4.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            TYPE_BADGE[q.type] ?? ''
                          )}
                        >
                          {(() => {
                            const I = TYPE_ICON[q.type];
                            return I ? <I className="h-3 w-3" /> : null;
                          })()}
                          {TYPE_SHORT[q.type] ?? q.type}
                        </span>
                        <p className="text-muted-foreground line-clamp-1 min-w-0 flex-1 text-sm">
                          {stripHtml(q.content)}
                        </p>
                        <span className="text-muted-foreground shrink-0 text-xs">{q.points}đ</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddOne(q);
                          }}
                          disabled={pending}
                          className="text-muted-foreground hover:text-primary shrink-0"
                          title="Thêm câu này"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
