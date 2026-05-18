'use client';

import { useState, useEffect, useTransition } from 'react';
import { Play, Send, Loader2, CheckCircle2, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, DEFAULT_WEB, type WebCode } from './WebEditor';
import { apiClient } from '@/lib/api-client';
import { createSocket } from '@/lib/socket';
import type { RunCodeResult, ExerciseSubmissionDetail } from '@lumibach/types';
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

type Submission = ExerciseSubmissionDetail;
type SubSummary = {
  id: string;
  status: CodeSubmissionStatus;
  score: number | null;
  maxScore: number | null;
  submittedAt: Date;
  attemptNumber: number;
  language: CodeLanguage;
};

type Props = {
  exerciseId: string;
  language: CodeLanguage;
  starterCode: string;
  starterHtml?: string | null;
  starterCss?: string | null;
  starterJs?: string | null;
  initialSubs: SubSummary[];
};

function parseWebCode(raw: string | null | undefined): WebCode | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) return p as WebCode;
  } catch {
    return null;
  }
  return null;
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

// ── Terminal output ────────────────────────────────────────────

function TerminalOutput({ result, pending }: { result: RunCodeResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);

  return (
    <div className="h-full overflow-x-auto bg-[#1a1a2e] px-4 py-3 font-mono text-sm">
      {pending && (
        <div className="flex items-center gap-2 text-[#7ec8e3]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Đang chạy...</span>
        </div>
      )}

      {!pending && !result && (
        <span className="text-xs text-[#555577] italic">Nhấn ▶ Chạy để xem kết quả</span>
      )}

      {!pending && result && (
        <div className="space-y-2">
          {/* Compile error */}
          {result.compileOutput && (
            <div>
              <span className="text-xs font-bold tracking-wider text-[#ff6b6b] uppercase">
                Lỗi biên dịch:
              </span>
              <pre className="mt-0.5 text-xs whitespace-pre-wrap text-[#ff8585]">
                {result.compileOutput}
              </pre>
            </div>
          )}
          {/* Runtime stderr */}
          {result.stderr && (
            <div>
              <span className="text-xs font-bold tracking-wider text-[#ffd93d] uppercase">
                {result.compileOutput ? 'Stderr:' : 'Lỗi runtime:'}
              </span>
              <pre className="mt-0.5 text-xs whitespace-pre-wrap text-[#ffe066]">
                {result.stderr}
              </pre>
            </div>
          )}
          {/* stdout */}
          {result.stdout && (
            <pre className="text-xs whitespace-pre-wrap text-[#c8f7c5]">{result.stdout}</pre>
          )}
          {!hasError && !result.stdout && (
            <span className="text-xs text-[#555577] italic">(không có output)</span>
          )}
          {/* Stats */}
          <div className="flex items-center gap-3 border-t border-white/5 pt-1 text-xs text-[#555577]">
            <span>{result.statusDesc}</span>
            {result.time && <span>⏱ {result.time}s</span>}
            {result.memory && <span>💾 {(result.memory / 1024).toFixed(1)} MB</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

export function ExerciseSubmitPanel({
  exerciseId,
  language,
  starterCode,
  starterHtml,
  starterCss,
  starterJs,
  initialSubs,
}: Props) {
  const isWeb = language === 'WEB';

  const [code, setCode] = useState(starterCode);
  const [stdin, setStdin] = useState('');
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [webCode, setWebCode] = useState<WebCode>({
    html: starterHtml ?? DEFAULT_WEB.html,
    css: starterCss ?? DEFAULT_WEB.css,
    js: starterJs ?? DEFAULT_WEB.js,
  });

  const [subs, setSubs] = useState<SubSummary[]>(initialSubs);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<Submission | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);

  const [runPending, startRun] = useTransition();
  const [subPending, startSub] = useTransition();
  const [viewPending, startView] = useTransition();

  useEffect(() => {
    if (!pendingSubId) return;
    const socket = createSocket('/code-execution');
    socket.on('connect', () => {
      socket.emit('submission:join', pendingSubId);
    });
    socket.on(
      'submission:complete',
      (data: { status: CodeSubmissionStatus; score: number | null; maxScore: number | null }) => {
        setSubs((prev) =>
          prev.map((s) =>
            s.id === pendingSubId
              ? { ...s, status: data.status, score: data.score, maxScore: data.maxScore }
              : s
          )
        );
        setPendingSubId(null);
        if (data.status === 'ACCEPTED') toast.success('Tất cả test case passed!');
        else if (data.status === 'PARTIAL')
          toast.warning(`Đạt ${data.score}/${data.maxScore} điểm.`);
        else toast.error(`Kết quả: ${STATUS_LABEL[data.status]}`);
      }
    );
    const timeout = setTimeout(() => socket.disconnect(), 60_000);
    return () => {
      clearTimeout(timeout);
      socket.disconnect();
    };
  }, [pendingSubId]);

  function handleRun() {
    startRun(async () => {
      setRunResult(null);
      try {
        const result = await apiClient.post<RunCodeResult>(`/code-exercises/${exerciseId}/run`, {
          code,
          language,
          stdin,
        });
        setRunResult(result);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  function handleSubmit() {
    const codeToSubmit = isWeb ? JSON.stringify(webCode) : code;
    startSub(async () => {
      try {
        const res = await apiClient.post<{ submissionId: string; autoGraded: boolean }>(
          `/code-exercises/${exerciseId}/submit`,
          { code: codeToSubmit, language }
        );
        const newSub: SubSummary = {
          id: res.submissionId,
          status: res.autoGraded ? 'PENDING' : 'MANUAL_REVIEW',
          score: null,
          maxScore: null,
          submittedAt: new Date(),
          attemptNumber: (subs[0]?.attemptNumber ?? 0) + 1,
          language,
        };
        setSubs((prev) => [newSub, ...prev]);
        if (res.autoGraded) {
          setPendingSubId(res.submissionId);
          toast.info('Đang chấm bài tự động...');
        } else {
          toast.success('Đã nộp bài! Giáo viên sẽ xem và chấm điểm.');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  function handleViewSub(subId: string) {
    setActiveSubId(subId);
    setActiveSub(null);
    startView(async () => {
      try {
        const sub = await apiClient.get<Submission>(`/code-exercises/submissions/${subId}`);
        setActiveSub(sub);
      } catch {
        setActiveSub(null);
      }
    });
  }

  const canRun = !isWeb && code.trim().length > 0;
  const canSubmit = isWeb
    ? webCode.html.trim().length > 0 ||
      webCode.css.trim().length > 0 ||
      webCode.js.trim().length > 0
    : code.trim().length > 0;

  return (
    <div className="space-y-5">
      {isWeb ? (
        <div className="rounded-xl bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent p-[1px] shadow-sm">
          <div className="flex flex-col overflow-hidden rounded-xl border-transparent bg-[#1a1a2e]">
            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-[#1a1a2e] px-3 py-2">
              <span className="rounded-md border border-white/20 bg-black/20 px-3 py-1 text-sm font-medium text-[#f8f8f2]">
                {LANG_LABEL[language]}
              </span>
              <div className="flex-1" />

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={runPending || subPending || !canSubmit}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 40%)' }}
              >
                {subPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Nộp bài
              </button>
            </div>

            <WebEditor
              initialHtml={webCode.html}
              initialCss={webCode.css}
              initialJs={webCode.js}
              onChange={setWebCode}
              height={560}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-stretch gap-5 lg:flex-row">
          {/* Left Side: Editor */}
          <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent p-[1px] shadow-sm">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-transparent bg-[#1a1a2e]">
              {/* Toolbar */}
              <div className="flex items-center gap-3 border-b border-white/10 bg-[#1a1a2e] px-3 py-2">
                <span className="rounded-md border border-white/20 bg-black/20 px-3 py-1 text-sm font-medium text-[#f8f8f2]">
                  {LANG_LABEL[language]}
                </span>
                <div className="flex-1" />

                <button
                  type="button"
                  onClick={handleRun}
                  disabled={runPending || subPending || !canRun}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-3 py-1.5 text-sm font-medium text-[#f8f8f2] transition-colors hover:bg-[#6272a4] disabled:opacity-50"
                >
                  {runPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current text-[#50fa7b]" />
                  )}
                  Chạy
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={runPending || subPending || !canSubmit}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                  style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 40%)' }}
                >
                  {subPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Nộp bài
                </button>
              </div>

              <div className="flex-1 bg-[#1a1a2e]">
                <CodeEditor value={code} onChange={setCode} language={language} height={560} />
              </div>
            </div>
          </div>

          {/* Right Side: Stdin & Terminal */}
          <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[450px] xl:w-[500px]">
            {/* stdin */}
            <div className="flex flex-col rounded-xl bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] p-[1px] shadow-sm">
              <div className="flex flex-col overflow-hidden rounded-xl border-transparent bg-[#1a1a2e]">
                <div className="flex-shrink-0 border-b border-white/10 bg-[#1a1a2e] px-4 py-3">
                  <label className="text-xs font-semibold tracking-wide text-[#f8f8f2] uppercase">
                    Dữ liệu vào (stdin)
                  </label>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Nhập dữ liệu đầu vào cho chương trình..."
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-md border border-white/20 bg-[#0d0d1a] px-3 py-2 font-mono text-sm text-[#f8f8f2] placeholder:text-[#6272a4] focus:ring-1 focus:ring-[#bd93f9] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Terminal */}
            <div className="flex min-h-[250px] flex-1 flex-col rounded-xl bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] p-[1px] shadow-sm">
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border-transparent bg-[#1a1a2e]">
                <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2">
                  <Terminal className="h-3.5 w-3.5 text-[#7ec8e3]" />
                  <span className="text-xs font-semibold tracking-wider text-[#7ec8e3] uppercase">
                    Output
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto bg-[#1a1a2e]">
                  <TerminalOutput result={runResult} pending={runPending} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Submission history ──────────────────────────────── */}
      {subs.length > 0 && (
        <div className="border-border overflow-hidden rounded-xl border">
          <p className="border-border border-b px-4 py-2 text-sm font-semibold">Lịch sử nộp bài</p>
          <div className="divide-border divide-y">
            {subs.map((sub) => (
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
            ))}
          </div>

          {/* Loading detail */}
          {viewPending && !activeSub && (
            <div className="border-border bg-muted/20 text-muted-foreground flex items-center gap-2 border-t px-4 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chi tiết...
            </div>
          )}

          {/* Detail panel */}
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

              {activeSub.feedback && (
                <div className="border-border bg-card text-muted-foreground rounded-lg border px-3 py-2.5 text-sm">
                  <span className="text-foreground font-semibold">Nhận xét: </span>
                  {activeSub.feedback}
                </div>
              )}

              {/* WEB: preview */}
              {activeSub.language === 'WEB' &&
                (() => {
                  const wc = parseWebCode(activeSub.code);
                  return wc ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">Code đã nộp (chỉ xem):</p>
                      <WebEditor
                        initialHtml={wc.html}
                        initialCss={wc.css}
                        initialJs={wc.js}
                        readOnly
                        height={420}
                      />
                    </div>
                  ) : null;
                })()}

              {/* Non-WEB: read-only code + run */}
              {activeSub.language !== 'WEB' && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">Code đã nộp (chỉ xem):</p>
                  <div className="border-border overflow-hidden rounded-xl border">
                    <CodeEditor
                      value={activeSub.code}
                      language={activeSub.language}
                      readOnly
                      height={280}
                    />
                  </div>

                  {/* Quick run from submission view */}
                  <QuickRun
                    exerciseId={exerciseId}
                    code={activeSub.code}
                    language={activeSub.language}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── QuickRun inside submission detail ─────────────────────────

function QuickRun({
  exerciseId,
  code,
  language,
}: {
  exerciseId: string;
  code: string;
  language: CodeLanguage;
}) {
  const [stdin, setStdin] = useState('');
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [pending, startRun] = useTransition();

  function handleRun() {
    startRun(async () => {
      setRunResult(null);
      try {
        const result = await apiClient.post<RunCodeResult>(`/code-exercises/${exerciseId}/run`, {
          code,
          language,
          stdin,
        });
        setRunResult(result);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="border-border mt-1 overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/30 flex items-center gap-3 border-b px-4 py-2.5">
        <label className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          Chạy thử code này
        </label>
        <button
          type="button"
          onClick={handleRun}
          disabled={pending}
          className="border-border bg-card hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3 fill-current text-green-500" />
          )}
          Chạy
        </button>
      </div>
      <div className="bg-muted/20 border-border border-b px-4 py-2">
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Stdin (tuỳ chọn)..."
          rows={2}
          className="placeholder:text-muted-foreground/50 w-full resize-y bg-transparent font-mono text-xs focus:outline-none"
        />
      </div>
      <TerminalOutput result={runResult} pending={pending} />
    </div>
  );
}
