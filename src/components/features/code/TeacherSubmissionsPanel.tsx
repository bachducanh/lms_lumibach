'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Eye, Save, Play, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, type WebCode } from './WebEditor';
import {
  getExerciseSubmissionAction,
  gradeWebSubmissionAction,
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

// ── Types ─────────────────────────────────────────────────────

type StudentInfo = {
  id: string; firstName: string; lastName: string;
  fullName: string | null; email: string;
};

type SubRow = {
  id: string; studentId: string; status: CodeSubmissionStatus;
  score: number | null; maxScore: number | null;
  submittedAt: Date; attemptNumber: number; language: CodeLanguage;
  student: StudentInfo;
};

type Submission = NonNullable<Awaited<ReturnType<typeof getExerciseSubmissionAction>>>;

type Props = {
  exerciseId:  string;
  language:    CodeLanguage;
  initialSubs: SubRow[];
};

// ── Helpers ───────────────────────────────────────────────────

function parseWebCode(raw: string | null | undefined): WebCode | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) return p as WebCode;
  } catch { /* empty */ }
  return null;
}

function fmt(d: Date | string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

function displayName(s: StudentInfo) {
  return s.fullName || `${s.firstName} ${s.lastName}`.trim() || s.email;
}

// ── Terminal output (for QuickRun) ────────────────────────────

function TerminalOutput({ result, pending }: { result: RunCodeResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);
  return (
    <div className="min-h-[100px] bg-[#1a1a2e] dark:bg-[#0d0d1a] rounded-b-xl font-mono text-sm px-4 py-3 overflow-x-auto">
      {pending && (
        <div className="flex items-center gap-2 text-[#7ec8e3]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Đang chạy...</span>
        </div>
      )}
      {!pending && !result && (
        <span className="text-[#555577] italic text-xs">Nhấn ▶ Chạy để kiểm tra output</span>
      )}
      {!pending && result && (
        <div className="space-y-2">
          {result.compileOutput && (
            <div>
              <span className="text-[#ff6b6b] text-xs font-bold uppercase tracking-wider">Lỗi biên dịch:</span>
              <pre className="text-[#ff8585] mt-0.5 whitespace-pre-wrap text-xs">{result.compileOutput}</pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <span className="text-[#ffd93d] text-xs font-bold uppercase tracking-wider">
                {result.compileOutput ? 'Stderr:' : 'Lỗi runtime:'}
              </span>
              <pre className="text-[#ffe066] mt-0.5 whitespace-pre-wrap text-xs">{result.stderr}</pre>
            </div>
          )}
          {result.stdout && (
            <pre className="text-[#c8f7c5] whitespace-pre-wrap text-xs">{result.stdout}</pre>
          )}
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

// ── QuickRun panel ────────────────────────────────────────────

function QuickRun({
  exerciseId, code, language,
}: {
  exerciseId: string;
  code:       string;
  language:   CodeLanguage;
}) {
  const [stdin,     setStdin]     = useState('');
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [pending,   startRun]     = useTransition();

  function handleRun() {
    startRun(async () => {
      setRunResult(null);
      const res = await runCodeAction(exerciseId, code, language, stdin);
      if (!res.success) { toast.error(res.error); return; }
      setRunResult(res.result);
    });
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex items-center gap-3">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
          Chạy thử code này
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current text-green-500" />}
          Chạy
        </button>
      </div>
      <div className="bg-muted/20 px-4 py-2 border-b border-border">
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Stdin (tùy chọn)..."
          rows={2}
          className="w-full resize-y bg-transparent font-mono text-xs focus:outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <TerminalOutput result={runResult} pending={pending} />
    </div>
  );
}

// ── Grade form (dùng chung cho mọi ngôn ngữ) ─────────────────

function GradeForm({
  selectedId,
  gradeScore, setGradeScore,
  gradeMax,   setGradeMax,
  feedback,   setFeedback,
  onGrade,    gradePending,
}: {
  selectedId:    string | null;
  gradeScore:    string;
  setGradeScore: (v: string) => void;
  gradeMax:      string;
  setGradeMax:   (v: string) => void;
  feedback:      string;
  setFeedback:   (v: string) => void;
  onGrade:       () => void;
  gradePending:  boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">Chấm điểm</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Điểm đạt</label>
          <input
            type="number" min={0} step={0.5}
            value={gradeScore}
            onChange={(e) => setGradeScore(e.target.value)}
            className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="0"
          />
        </div>
        <span className="text-muted-foreground mb-1.5">/</span>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Điểm tối đa</label>
          <input
            type="number" min={1} step={0.5}
            value={gradeMax}
            onChange={(e) => setGradeMax(e.target.value)}
            className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="10"
          />
        </div>
        <Button
          size="sm"
          onClick={onGrade}
          disabled={gradePending || !gradeScore || !selectedId}
          className="gap-1.5 mb-0.5"
        >
          {gradePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lưu điểm
        </Button>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nhận xét (tùy chọn)</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder="Nhận xét về bài làm..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

export function TeacherSubmissionsPanel({ exerciseId, language, initialSubs }: Props) {
  const isWeb = language === 'WEB';

  const [subs,         setSubs]         = useState<SubRow[]>(initialSubs);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [detail,       setDetail]       = useState<Submission | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [gradeScore,   setGradeScore]   = useState('');
  const [gradeMax,     setGradeMax]     = useState('10');
  const [feedback,     setFeedback]     = useState('');
  const [gradePending, startGrade]      = useTransition();

  async function handleView(subId: string) {
    if (selectedId === subId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(subId);
    setDetail(null);
    setLoading(true);
    const sub = await getExerciseSubmissionAction(subId);
    setDetail(sub ?? null);
    if (sub) {
      setGradeScore(sub.score?.toString() ?? '');
      setGradeMax(sub.maxScore?.toString() ?? '10');
      setFeedback((sub as any).feedback ?? '');
    }
    setLoading(false);
  }

  function handleGrade() {
    if (!selectedId) return;
    const score = parseFloat(gradeScore);
    const max   = parseFloat(gradeMax);
    if (isNaN(score) || isNaN(max) || score < 0 || score > max) {
      toast.error('Điểm không hợp lệ (phải từ 0 đến điểm tối đa)');
      return;
    }
    startGrade(async () => {
      const r = await gradeWebSubmissionAction(selectedId, score, max, feedback || undefined);
      if (r.success) {
        toast.success('Đã chấm điểm!');
        setSubs((prev) =>
          prev.map((s) =>
            s.id === selectedId
              ? { ...s, status: 'ACCEPTED' as CodeSubmissionStatus, score, maxScore: max }
              : s,
          ),
        );
        setDetail((prev) =>
          prev ? { ...prev, status: 'ACCEPTED', score, maxScore: max } as Submission : null,
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  const gradeFormProps = {
    selectedId, gradeScore, setGradeScore,
    gradeMax, setGradeMax, feedback, setFeedback,
    onGrade: handleGrade, gradePending,
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
        <div>
          <h3 className="font-semibold">Bài nộp của học sinh</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subs.length} lượt nộp · Tất cả cần chấm thủ công
          </p>
        </div>
      </div>

      {subs.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          Chưa có học sinh nào nộp bài.
        </p>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Học sinh</th>
                  <th className="px-4 py-2.5 text-center w-16">Lần</th>
                  <th className="px-4 py-2.5 text-center">Trạng thái</th>
                  <th className="px-4 py-2.5 text-center w-24">Điểm</th>
                  <th className="px-4 py-2.5 text-right">Thời gian</th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subs.map((sub) => (
                  <tr
                    key={sub.id}
                    className={cn(
                      'transition-colors hover:bg-muted/20',
                      selectedId === sub.id && 'bg-primary/5',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{displayName(sub.student)}</p>
                      <p className="text-xs text-muted-foreground">{sub.student.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">#{sub.attemptNumber}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[sub.status])}>
                        {STATUS_LABEL[sub.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">
                      {sub.score != null && sub.maxScore != null
                        ? `${sub.score}/${sub.maxScore}`
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(sub.submittedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleView(sub.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          selectedId === sub.id
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border hover:bg-accent',
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {(loading || detail) && (
            <div className="border-t border-border bg-muted/10 p-6 space-y-5">
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && detail && (
                <>
                  {/* Sub header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {displayName(
                          subs.find((s) => s.id === selectedId)?.student ?? {
                            id: '', firstName: '', lastName: '', fullName: null, email: '',
                          },
                        )}
                        {' '}— Lần #{detail.attemptNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmt(detail.submittedAt)}</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[detail.status])}>
                      {STATUS_LABEL[detail.status]}
                      {detail.score != null && detail.maxScore != null && ` · ${detail.score}/${detail.maxScore}`}
                    </span>
                  </div>

                  {/* WEB: preview + grade form */}
                  {isWeb && (() => {
                    const wc = parseWebCode(detail.code);
                    return (
                      <div className="space-y-4">
                        {wc ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code đã nộp (chỉ xem)</p>
                            <WebEditor
                              initialHtml={wc.html}
                              initialCss={wc.css}
                              initialJs={wc.js}
                              readOnly
                              height={400}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Không đọc được code đã nộp.</p>
                        )}
                        <GradeForm {...gradeFormProps} />
                      </div>
                    );
                  })()}

                  {/* Python / C++: code + run panel + grade form */}
                  {!isWeb && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code đã nộp (chỉ xem)</p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <CodeEditor
                            value={detail.code}
                            language={language}
                            readOnly
                            height={300}
                          />
                        </div>
                      </div>

                      <QuickRun
                        exerciseId={exerciseId}
                        code={detail.code}
                        language={language}
                      />

                      <GradeForm {...gradeFormProps} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
