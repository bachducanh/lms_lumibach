'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Play, Send, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import {
  runSampleTestsAction,
  submitCodeAssignmentAction,
  getCodeSubmissionAction,
} from '@/actions/code';
import { cn } from '@/lib/utils';
import type { CodeLanguage, CodeSubmissionStatus } from '@lumibach/db';

// ── Constants ─────────────────────────────────────────────────

const LANG_LABEL: Record<CodeLanguage, string> = {
  PYTHON3: 'Python 3',
  JAVASCRIPT: 'JavaScript',
  CPP17: 'C++ 17',
  WEB: 'Web (HTML/CSS/JS)',
  SCRATCH: 'Scratch',
};

const STATUS_LABEL: Record<CodeSubmissionStatus, string> = {
  PENDING: 'Đang chờ...',
  PROCESSING: 'Đang chấm...',
  ACCEPTED: 'Hoàn thành',
  PARTIAL: 'Một phần',
  WRONG_ANSWER: 'Sai đáp án',
  COMPILE_ERROR: 'Lỗi biên dịch',
  RUNTIME_ERROR: 'Lỗi runtime',
  TIME_LIMIT: 'Quá thời gian',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  MANUAL_REVIEW: 'Chờ chấm tay',
};

const STATUS_CLASS: Record<CodeSubmissionStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  PROCESSING: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  ACCEPTED: 'bg-green-500/10 text-green-700 dark:text-green-400',
  PARTIAL: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  WRONG_ANSWER: 'bg-red-500/10 text-destructive',
  COMPILE_ERROR: 'bg-red-500/10 text-destructive',
  RUNTIME_ERROR: 'bg-red-500/10 text-destructive',
  TIME_LIMIT: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  INTERNAL_ERROR: 'bg-muted text-muted-foreground',
  MANUAL_REVIEW: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
};

// ── Types ─────────────────────────────────────────────────────

type SampleItem = {
  testCaseId: string;
  label: string | null;
  input: string;
  expected: string;
  status: CodeSubmissionStatus;
  stdout: string | null;
  stderr: string | null;
  compileOut: string | null;
  time: string | null;
  memory: number | null;
  passed: boolean;
};
type Submission = NonNullable<Awaited<ReturnType<typeof getCodeSubmissionAction>>>;
type SubSummary = {
  id: string;
  status: CodeSubmissionStatus;
  score: number | null;
  maxScore: number | null;
  submittedAt: Date;
  attemptNumber: number;
};

type Props = {
  assignmentId: string;
  language: CodeLanguage;
  starterCode: string;
  initialSubs: SubSummary[];
};

const DONE_STATUSES: CodeSubmissionStatus[] = [
  'ACCEPTED',
  'PARTIAL',
  'WRONG_ANSWER',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT',
  'INTERNAL_ERROR',
];

// ── Component ─────────────────────────────────────────────────

export function CodeSubmitPanel({ assignmentId, language, starterCode, initialSubs }: Props) {
  const [code, setCode] = useState(starterCode);
  const [sampleRes, setSampleRes] = useState<SampleItem[]>([]);
  const [showSamples, setShowSamples] = useState(false);
  const [submissions, setSubmissions] = useState<SubSummary[]>(initialSubs);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<Submission | null>(null);

  const [runPending, startRun] = useTransition();
  const [subPending, startSub] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll active submission until done ──
  useEffect(() => {
    if (!activeSubId) return;
    const current = submissions.find((s) => s.id === activeSubId);
    if (current && DONE_STATUSES.includes(current.status)) return;

    pollRef.current = setInterval(async () => {
      const sub = await getCodeSubmissionAction(activeSubId);
      if (!sub) return;
      setActiveSub(sub);
      if (DONE_STATUSES.includes(sub.status)) {
        clearInterval(pollRef.current!);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? { ...s, status: sub.status, score: sub.score, maxScore: sub.maxScore }
              : s
          )
        );
      }
    }, 2_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSubId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRunSamples() {
    startRun(async () => {
      setSampleRes([]);
      const res = await runSampleTestsAction(assignmentId, code, language);
      if (res.success) {
        setSampleRes(res.results as SampleItem[]);
        setShowSamples(true);
      } else toast.error(res.error);
    });
  }

  function handleSubmit() {
    startSub(async () => {
      const res = await submitCodeAssignmentAction(assignmentId, code, language);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Đã nộp bài! Đang chấm tự động...');
      const newSub: SubSummary = {
        id: res.submissionId,
        status: 'PENDING',
        score: null,
        maxScore: null,
        submittedAt: new Date(),
        attemptNumber: (submissions[0]?.attemptNumber ?? 0) + 1,
      };
      setSubmissions((prev) => [newSub, ...prev]);
      setActiveSubId(res.submissionId);
      setActiveSub(null);
    });
  }

  async function handleViewSub(subId: string) {
    setActiveSubId(subId);
    const sub = await getCodeSubmissionAction(subId);
    setActiveSub(sub);
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  return (
    <div className="space-y-5">
      {/* ── Editor ─────────────────────────────────────────── */}
      <div className="border-border overflow-hidden rounded-xl border">
        {/* Toolbar */}
        <div className="border-border bg-muted/40 flex items-center gap-3 border-b px-3 py-2">
          <span className="border-input bg-background text-muted-foreground rounded-md border px-3 py-1 text-sm">
            {LANG_LABEL[language]}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleRunSamples}
            disabled={runPending || subPending || !code.trim()}
            className="border-border bg-card hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {runPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current text-green-600" />
            )}
            Chạy mẫu
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={runPending || subPending || !code.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {subPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Nộp bài
          </button>
        </div>
        <CodeEditor value={code} onChange={setCode} language={language} height={380} />
      </div>

      {/* ── Sample test results ─────────────────────────────── */}
      {(runPending || (showSamples && sampleRes.length > 0)) && (
        <div className="border-border overflow-hidden rounded-xl border">
          <p className="border-border border-b px-4 py-2 text-sm font-semibold">Kết quả test mẫu</p>
          {runPending && (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang chạy...
            </div>
          )}
          {sampleRes.length > 0 && (
            <div className="divide-border divide-y">
              {sampleRes.map((r, i) => (
                <div key={r.testCaseId} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.passed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="text-destructive h-4 w-4 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{r.label ?? `Test mẫu ${i + 1}`}</span>
                    <span
                      className={cn(
                        'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
                        r.passed
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'text-destructive bg-red-500/10'
                      )}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.time && <span className="text-muted-foreground text-xs">⏱ {r.time}s</span>}
                    {r.memory && (
                      <span className="text-muted-foreground text-xs">
                        💾 {(r.memory / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  {(r.stdout || r.stderr || r.compileOut) && (
                    <pre
                      className={cn(
                        'bg-muted/50 rounded-md px-3 py-2 font-mono text-xs',
                        r.passed ? '' : 'text-destructive'
                      )}
                    >
                      {r.compileOut || r.stderr || r.stdout}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Submission history ──────────────────────────────── */}
      {submissions.length > 0 && (
        <div className="border-border overflow-hidden rounded-xl border">
          <p className="border-border border-b px-4 py-2 text-sm font-semibold">Lịch sử nộp bài</p>
          <div className="divide-border divide-y">
            {submissions.map((sub) => {
              const isPending = !DONE_STATUSES.includes(sub.status);
              return (
                <div
                  key={sub.id}
                  className={cn(
                    'hover:bg-muted/30 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                    activeSubId === sub.id && 'bg-muted/30'
                  )}
                  onClick={() => handleViewSub(sub.id)}
                >
                  <span className="text-muted-foreground w-14 shrink-0 text-xs">
                    Lần {sub.attemptNumber}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STATUS_CLASS[sub.status]
                    )}
                  >
                    {isPending && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                    {STATUS_LABEL[sub.status]}
                  </span>
                  {sub.score != null && sub.maxScore != null && (
                    <span className="text-sm font-semibold tabular-nums">
                      {sub.score}/{sub.maxScore}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {fmt(sub.submittedAt)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active submission detail */}
          {activeSub && (
            <div className="border-border bg-muted/20 space-y-3 border-t px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Chi tiết — Lần {activeSub.attemptNumber}</p>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    STATUS_CLASS[activeSub.status]
                  )}
                >
                  {STATUS_LABEL[activeSub.status]}
                  {activeSub.score != null &&
                    activeSub.maxScore != null &&
                    ` (${activeSub.score}/${activeSub.maxScore})`}
                </span>
              </div>

              {!DONE_STATUSES.includes(activeSub.status) && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang chấm tự động...
                </div>
              )}

              {activeSub.results.length > 0 && (
                <div className="divide-border border-border divide-y overflow-hidden rounded-lg border">
                  {activeSub.results.map((r, i) => (
                    <div key={r.testCase.position} className="flex items-center gap-3 px-3 py-2.5">
                      {r.status === 'ACCEPTED' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      ) : r.status === 'PENDING' || r.status === 'PROCESSING' ? (
                        <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : r.testCase.isHidden ? (
                        <AlertTriangle className="text-destructive h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="text-destructive h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="text-sm">
                        {r.testCase.label ?? `Test ${i + 1}`}
                        {r.testCase.isHidden && (
                          <span className="text-muted-foreground ml-1 text-xs">(ẩn)</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-xs font-medium',
                          r.status === 'ACCEPTED'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-destructive'
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.time != null && (
                        <span className="text-muted-foreground text-xs">⏱ {r.time}s</span>
                      )}
                      {r.memory != null && (
                        <span className="text-muted-foreground text-xs">
                          💾 {(r.memory / 1024).toFixed(1)} MB
                        </span>
                      )}
                      {r.score != null && (
                        <span className="w-12 text-right text-xs font-semibold tabular-nums">
                          {r.score}/{r.testCase.points}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
