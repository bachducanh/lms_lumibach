'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Eye, Save, Play, Terminal, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, type WebCode } from './WebEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getExerciseSubmissionAction,
  gradeWebSubmissionAction,
  deleteSubmissionAction,
  runCodeAction,
  type RunCodeResult,
} from '@/actions/exercises';
import { cn } from '@/lib/utils';
import type { CodeLanguage, CodeSubmissionStatus } from '@prisma/client';

// ── Constants ─────────────────────────────────────────────────

const STATUS_LABEL: Record<CodeSubmissionStatus, string> = {
  PENDING:        'Đang chờ',
  PROCESSING:     'Đang chấm',
  ACCEPTED:       'Hoàn thành',
  PARTIAL:        'Một phần',
  WRONG_ANSWER:   'Sai đáp án',
  COMPILE_ERROR:  'Lỗi biên dịch',
  RUNTIME_ERROR:  'Lỗi runtime',
  TIME_LIMIT:     'Quá thời gian',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  MANUAL_REVIEW:  'Chờ chấm tay',
};

const STATUS_CLASS: Record<CodeSubmissionStatus, string> = {
  PENDING:        'bg-muted text-muted-foreground',
  PROCESSING:     'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  ACCEPTED:       'bg-green-500/10 text-green-700 dark:text-green-400',
  PARTIAL:        'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  WRONG_ANSWER:   'bg-red-500/10 text-destructive',
  COMPILE_ERROR:  'bg-red-500/10 text-destructive',
  RUNTIME_ERROR:  'bg-red-500/10 text-destructive',
  TIME_LIMIT:     'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  INTERNAL_ERROR: 'bg-muted text-muted-foreground',
  MANUAL_REVIEW:  'bg-purple-500/10 text-purple-700 dark:text-purple-400',
};

const fmt = (d: Date | string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));

// ── Types ─────────────────────────────────────────────────────

type Submission = NonNullable<Awaited<ReturnType<typeof getExerciseSubmissionAction>>>;

type SubRow = {
  id:           string;
  studentId:    string;
  status:       CodeSubmissionStatus;
  score:        number | null;
  maxScore:     number | null;
  submittedAt:  Date;
  attemptNumber: number;
  language:     CodeLanguage;
  student: {
    id:        string;
    firstName: string;
    lastName:  string;
    fullName:  string | null;
    email:     string;
  };
};

type Props = {
  exerciseId:   string;
  initialSubs:  SubRow[];
  language:     CodeLanguage;
};

function parseWebCode(raw: string | null | undefined): WebCode | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) return p as WebCode;
  } catch {}
  return null;
}

// ── Terminal output ────────────────────────────────────────────

function TerminalOutput({ result, pending }: { result: RunCodeResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);
  return (
    <div className="min-h-[100px] bg-[#1a1a2e] rounded-lg font-mono text-sm px-4 py-3 overflow-x-auto">
      {pending && (
        <div className="flex items-center gap-2 text-[#7ec8e3]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Đang chạy...</span>
        </div>
      )}
      {!pending && !result && (
        <span className="text-[#555577] italic text-xs">Nhấn ▶ để chạy thử code</span>
      )}
      {!pending && result && (
        <div className="space-y-2">
          {result.compileOutput && (
            <div>
              <span className="text-[#ff6b6b] text-xs font-bold">Lỗi biên dịch:</span>
              <pre className="text-[#ff8585] mt-0.5 whitespace-pre-wrap text-xs">{result.compileOutput}</pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <span className="text-[#ffd93d] text-xs font-bold">Lỗi runtime:</span>
              <pre className="text-[#ffe066] mt-0.5 whitespace-pre-wrap text-xs">{result.stderr}</pre>
            </div>
          )}
          {result.stdout && <pre className="text-[#c8f7c5] whitespace-pre-wrap text-xs">{result.stdout}</pre>}
          {!hasError && !result.stdout && (
            <span className="text-[#555577] italic text-xs">(không có output)</span>
          )}
          <div className="flex items-center gap-3 pt-1 text-[#555577] text-xs border-t border-white/5">
            <span>{result.statusDesc}</span>
            {result.time   && <span>⏱ {result.time}s</span>}
            {result.memory && <span>💾 {(result.memory / 1024).toFixed(1)} MB</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grade form ─────────────────────────────────────────────────

function GradeForm({
  submissionId, initial, onSaved,
}: {
  submissionId: string;
  initial: { score: string; maxScore: string; feedback: string };
  onSaved: (score: number, maxScore: number, feedback: string) => void;
}) {
  const [score,    setScore]    = useState(initial.score);
  const [maxScore, setMaxScore] = useState(initial.maxScore);
  const [feedback, setFeedback] = useState(initial.feedback);
  const [saving,   startSave]   = useTransition();

  function handleSave() {
    startSave(async () => {
      const s = parseFloat(score) || 0;
      const m = parseFloat(maxScore) || 10;
      const res = await gradeWebSubmissionAction(submissionId, s, m, feedback);
      if (res.success) {
        toast.success('Đã lưu điểm');
        onSaved(s, m, feedback);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chấm điểm</p>
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Điểm</label>
          <input
            type="number" min={0} step={0.5}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-muted-foreground mt-4">/</span>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tổng</label>
          <input
            type="number" min={1} step={0.5}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          size="sm" className="mt-4 gap-1.5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lưu điểm
        </Button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Nhận xét (tuỳ chọn)</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Nhận xét cho học sinh..."
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

// ── Submission detail dialog ───────────────────────────────────

function SubmissionDialog({
  exerciseId,
  row,
  onClose,
  onGraded,
  onDeleted,
}: {
  exerciseId: string;
  row:        SubRow;
  onClose:    () => void;
  onGraded:   (id: string, score: number, maxScore: number, feedback: string) => void;
  onDeleted:  (id: string) => void;
}) {
  const [detail,    setDetail]    = useState<Submission | null>(null);
  const [loading,   startLoad]    = useTransition();
  const [deleting,  startDelete]  = useTransition();
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [stdin,     setStdin]     = useState('');
  const [running,   startRun]     = useTransition();

  // Load detail on open
  useEffect(() => {
    startLoad(async () => {
      const sub = await getExerciseSubmissionAction(row.id);
      setDetail(sub ?? null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  function handleRun() {
    if (!detail) return;
    startRun(async () => {
      setRunResult(null);
      const res = await runCodeAction(exerciseId, detail.code, detail.language, stdin);
      if (!res.success) { toast.error(res.error); return; }
      setRunResult(res.result);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const res = await deleteSubmissionAction(row.id);
      if (res.success) {
        toast.success('Đã xoá bài nộp');
        onDeleted(row.id);
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  const studentName = (row.student.fullName ?? `${row.student.firstName} ${row.student.lastName}`.trim()) || row.student.email;

  const webCode = detail ? parseWebCode(detail.language === 'WEB' ? detail.code : null) : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-7xl xl:max-w-[1600px] w-[95vw] max-h-[95vh] overflow-y-auto"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-2">
            <div className="space-y-0.5">
              <DialogTitle>
                {studentName} — Lần {row.attemptNumber}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {fmt(row.submittedAt)} · {row.language}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0', STATUS_CLASS[row.status])}>
                {STATUS_LABEL[row.status]}
                {row.score != null && row.maxScore != null && ` (${row.score}/${row.maxScore})`}
              </span>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Loading */}
        {loading && !detail && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Đang tải...</span>
          </div>
        )}

        {/* Content */}
        {detail && (
          <div className="space-y-4 mt-2">
            {/* WEB preview */}
            {detail.language === 'WEB' && webCode && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Code đã nộp:</p>
                <WebEditor
                  initialHtml={webCode.html}
                  initialCss={webCode.css}
                  initialJs={webCode.js}
                  readOnly
                  height={380}
                />
              </div>
            )}

            {/* Non-WEB code + quick run */}
            {detail.language !== 'WEB' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Code đã nộp:</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <CodeEditor
                    value={detail.code}
                    language={detail.language}
                    readOnly
                    height={260}
                  />
                </div>

                {/* Quick run */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground flex-1">Chạy thử</span>
                    <button
                      onClick={handleRun}
                      disabled={running}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current text-green-500" />}
                      Chạy
                    </button>
                  </div>
                  <div className="bg-muted/20 px-4 py-2 border-b border-border">
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Stdin (tuỳ chọn)..."
                      rows={2}
                      className="w-full resize-y bg-transparent font-mono text-xs focus:outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <TerminalOutput result={runResult} pending={running} />
                </div>
              </div>
            )}

            {/* Grade form */}
            <GradeForm
              submissionId={detail.id}
              initial={{
                score:    detail.score?.toString()    ?? '',
                maxScore: detail.maxScore?.toString() ?? '10',
                feedback: (detail as any).feedback    ?? '',
              }}
              onSaved={(s, m, fb) => onGraded(detail.id, s, m, fb)}
            />
          </div>
        )}

        {/* Footer — delete */}
        <div className="flex justify-end pt-2 border-t border-border mt-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Xoá bài nộp
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main panel ─────────────────────────────────────────────────

export function TeacherSubmissionsPanel({ exerciseId, initialSubs, language }: Props) {
  const [subs,     setSubs]    = useState<SubRow[]>(initialSubs);
  const [openRow,  setOpenRow] = useState<SubRow | null>(null);

  function handleGraded(id: string, score: number, maxScore: number, feedback: string) {
    setSubs((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, score, maxScore, status: 'ACCEPTED' as CodeSubmissionStatus }
          : s,
      ),
    );
  }

  function handleDeleted(id: string) {
    setSubs((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Bài nộp của học sinh</h2>
        <span className="text-xs text-muted-foreground">{subs.length} bài nộp</span>
      </div>

      {subs.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground rounded-xl border border-border bg-muted/10">
          Chưa có bài nộp nào.
        </div>
      )}

      {/* Dialog popup */}
      {openRow && (
        <SubmissionDialog
          exerciseId={exerciseId}
          row={openRow}
          onClose={() => setOpenRow(null)}
          onGraded={handleGraded}
          onDeleted={handleDeleted}
        />
      )}

      {subs.length > 0 && <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Học sinh</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Lần</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Trạng thái</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Điểm</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Thời gian nộp</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subs.map((sub) => {
              const name = (sub.student.fullName ?? `${sub.student.firstName} ${sub.student.lastName}`.trim()) || sub.student.email;
              return (
                <tr
                  key={sub.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-[180px]">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.student.email}</p>
                  </td>
                  <td className="px-3 py-3 text-center text-muted-foreground">#{sub.attemptNumber}</td>
                  <td className="px-3 py-3">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_CLASS[sub.status])}>
                      {STATUS_LABEL[sub.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">
                    {sub.score != null && sub.maxScore != null
                      ? `${sub.score}/${sub.maxScore}`
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {fmt(sub.submittedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant={openRow?.id === sub.id ? 'default' : 'outline'}
                      className="gap-1.5 h-7 px-2.5 text-xs"
                      onClick={() => setOpenRow(sub)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Xem
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
