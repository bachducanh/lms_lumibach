'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ScratchEditor } from './ScratchEditor';
import { gradeScratchSubmissionAction } from '@/actions/scratch';
import { RubricGradePanel } from '@/components/features/code/RubricGradePanel';
import type { RubricData } from '@lumibach/types';
import { Users, CheckCircle2, Clock, Eye, Save, X } from 'lucide-react';

type Submission = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  submittedAt: Date;
  attemptNumber: number;
  code: string;
  gradedAt: Date | null;
  student: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
};

type Props = {
  submissions: Submission[];
  /** When the exercise has a rubric, the teacher can grade with it instead of free-form. */
  rubric?: RubricData | null;
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

function authorName(s: Submission['student']) {
  return s.fullName ?? `${s.firstName} ${s.lastName}`.trim();
}

function parseSb3Url(code: string): string | null {
  try {
    return (JSON.parse(code) as { sb3Url?: string }).sb3Url ?? null;
  } catch {
    return null;
  }
}

export function ScratchTeacherPanel({ submissions, rubric }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Grading form state — keyed by submission id
  const [scoreInput, setScoreInput] = useState<Record<string, string>>({});
  const [maxScoreInput, setMaxScoreInput] = useState<Record<string, string>>({});
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});

  const open = submissions.find((s) => s.id === openId);

  function handleGrade(s: Submission) {
    const score = parseFloat(scoreInput[s.id] ?? String(s.score ?? ''));
    const maxScore = parseFloat(maxScoreInput[s.id] ?? String(s.maxScore ?? '10'));
    if (Number.isNaN(score)) {
      toast.error('Điểm không hợp lệ.');
      return;
    }

    startTransition(async () => {
      const res = await gradeScratchSubmissionAction({
        submissionId: s.id,
        score,
        maxScore: Number.isNaN(maxScore) ? 10 : maxScore,
        feedback: feedbackInput[s.id] ?? s.feedback ?? '',
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'Đã chấm.');
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-cyan-400" />
          Bài nộp của học sinh ({submissions.length})
        </h3>
      </div>

      {submissions.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Chưa có bài nộp nào.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => {
            const isGraded = !!s.gradedAt;
            return (
              <div
                key={s.id}
                className="border-border/60 bg-muted/10 overflow-hidden rounded-lg border"
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold">
                    {s.student.avatar ? (
                      <img
                        src={s.student.avatar}
                        alt={authorName(s.student)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      authorName(s.student).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{authorName(s.student)}</p>
                    <p className="text-muted-foreground text-xs">
                      Lần {s.attemptNumber} · Nộp lúc {fmtTime(s.submittedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isGraded ? (
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {s.score} / {s.maxScore}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <Clock className="h-3 w-3" />
                        Chờ chấm
                      </span>
                    )}
                    <Button
                      type="button"
                      variant={openId === s.id ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    >
                      {openId === s.id ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {openId === s.id ? 'Đóng' : 'Mở bài'}
                    </Button>
                  </div>
                </div>

                {/* Inline grading form (compact, no editor) */}
                {openId !== s.id && isGraded && s.feedback && (
                  <div className="text-muted-foreground border-border/30 border-t px-4 pt-2 pb-3 text-xs">
                    <span className="text-foreground font-semibold">Nhận xét: </span>
                    <span className="whitespace-pre-wrap">{s.feedback}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submission viewer — popup dialog (matches Code Exercise grading UX) */}
      {open &&
        (() => {
          const url = parseSb3Url(open.code);
          const score = scoreInput[open.id] ?? (open.score !== null ? String(open.score) : '');
          const maxScore =
            maxScoreInput[open.id] ?? (open.maxScore !== null ? String(open.maxScore) : '10');
          const feedback = feedbackInput[open.id] ?? open.feedback ?? '';

          return (
            <Dialog
              open
              onOpenChange={(o) => {
                if (!o) setOpenId(null);
              }}
            >
              <DialogContent
                className="max-h-[95vh] w-[95vw] max-w-7xl overflow-y-auto xl:max-w-[1600px]"
                showCloseButton={false}
              >
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3 pr-2">
                    <div className="space-y-0.5">
                      <DialogTitle>
                        {authorName(open.student)} — Lần {open.attemptNumber}
                      </DialogTitle>
                      <p className="text-muted-foreground text-xs">
                        Nộp lúc {fmtTime(open.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!!open.gradedAt && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {open.score} / {open.maxScore}
                        </span>
                      )}
                      <button
                        onClick={() => setOpenId(null)}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </DialogHeader>

                <div className="mt-2 space-y-4">
                  {url ? (
                    <ScratchEditor starterUrl={url} playerOnly />
                  ) : (
                    <p className="text-destructive text-sm">Không tìm thấy file Scratch.</p>
                  )}

                  {rubric && (
                    <RubricGradePanel
                      rubric={rubric}
                      codeSubmissionId={open.id}
                      maxScore={Number(maxScore) || 10}
                      onGraded={() => {
                        router.refresh();
                        setOpenId(null);
                      }}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Điểm
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={score}
                        onChange={(e) =>
                          setScoreInput((prev) => ({ ...prev, [open.id]: e.target.value }))
                        }
                        className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Trên thang
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={maxScore}
                        onChange={(e) =>
                          setMaxScoreInput((prev) => ({ ...prev, [open.id]: e.target.value }))
                        }
                        className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={() => handleGrade(open)}
                        disabled={pending || !score}
                        className="w-full gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {pending ? 'Đang lưu...' : 'Lưu điểm'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Nhận xét (tuỳ chọn)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) =>
                        setFeedbackInput((prev) => ({ ...prev, [open.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Phản hồi cho học sinh..."
                      className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
    </div>
  );
}
