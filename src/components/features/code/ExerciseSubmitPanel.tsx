'use client';

import { useState, useTransition } from 'react';
import { Play, Send, Loader2, CheckCircle2, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, DEFAULT_WEB, type WebCode } from './WebEditor';
import {
  runCodeAction,
  submitExerciseAction,
  getExerciseSubmissionAction,
  type RunCodeResult,
} from '@/actions/exercises';
import { cn } from '@/lib/utils';
import type { CodeLanguage, CodeSubmissionStatus } from '@prisma/client';

// ── Constants ─────────────────────────────────────────────────

const LANG_LABEL: Record<CodeLanguage, string> = {
  PYTHON3:    'Python 3',
  JAVASCRIPT: 'JavaScript',
  CPP17:      'C++ 17',
  WEB:        'Web (HTML/CSS/JS)',
};

const STATUS_LABEL: Record<CodeSubmissionStatus, string> = {
  PENDING:        'Đang chờ...',
  PROCESSING:     'Đang chấm...',
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

type Submission = NonNullable<Awaited<ReturnType<typeof getExerciseSubmissionAction>>>;
type SubSummary = {
  id: string; status: CodeSubmissionStatus; score: number | null;
  maxScore: number | null; submittedAt: Date; attemptNumber: number; language: CodeLanguage;
};

type Props = {
  exerciseId:   string;
  language:     CodeLanguage;
  starterCode:  string;
  starterHtml?: string | null;
  starterCss?:  string | null;
  starterJs?:   string | null;
  initialSubs:  SubSummary[];
};

function parseWebCode(raw: string | null | undefined): WebCode | null {
  if (!raw) return null;
  try { const p = JSON.parse(raw); if (typeof p === 'object' && p !== null) return p as WebCode; } catch {}
  return null;
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));

// ── Terminal output ────────────────────────────────────────────

function TerminalOutput({ result, pending }: { result: RunCodeResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);

  return (
    <div className="min-h-[120px] bg-[#1a1a2e] rounded-b-xl font-mono text-sm px-4 py-3 overflow-x-auto">
      {pending && (
        <div className="flex items-center gap-2 text-[#7ec8e3]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Đang chạy...</span>
        </div>
      )}

      {!pending && !result && (
        <span className="text-[#555577] italic text-xs">Nhấn ▶ Chạy để xem kết quả</span>
      )}

      {!pending && result && (
        <div className="space-y-2">
          {/* Compile error */}
          {result.compileOutput && (
            <div>
              <span className="text-[#ff6b6b] text-xs font-bold uppercase tracking-wider">Lỗi biên dịch:</span>
              <pre className="text-[#ff8585] mt-0.5 whitespace-pre-wrap text-xs">{result.compileOutput}</pre>
            </div>
          )}
          {/* Runtime stderr */}
          {result.stderr && (
            <div>
              <span className="text-[#ffd93d] text-xs font-bold uppercase tracking-wider">
                {result.compileOutput ? 'Stderr:' : 'Lỗi runtime:'}
              </span>
              <pre className="text-[#ffe066] mt-0.5 whitespace-pre-wrap text-xs">{result.stderr}</pre>
            </div>
          )}
          {/* stdout */}
          {result.stdout && (
            <pre className="text-[#c8f7c5] whitespace-pre-wrap text-xs">{result.stdout}</pre>
          )}
          {!hasError && !result.stdout && (
            <span className="text-[#555577] italic text-xs">(không có output)</span>
          )}
          {/* Stats */}
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

// ── Component ─────────────────────────────────────────────────

export function ExerciseSubmitPanel({
  exerciseId, language, starterCode,
  starterHtml, starterCss, starterJs,
  initialSubs,
}: Props) {
  const isWeb = language === 'WEB';

  const [code,      setCode]      = useState(starterCode);
  const [stdin,     setStdin]     = useState('');
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const [webCode,   setWebCode]   = useState<WebCode>({
    html: starterHtml ?? DEFAULT_WEB.html,
    css:  starterCss  ?? DEFAULT_WEB.css,
    js:   starterJs   ?? DEFAULT_WEB.js,
  });

  const [subs,        setSubs]        = useState<SubSummary[]>(initialSubs);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSub,   setActiveSub]   = useState<Submission | null>(null);

  const [runPending,  startRun]  = useTransition();
  const [subPending,  startSub]  = useTransition();
  const [viewPending, startView] = useTransition();

  function handleRun() {
    startRun(async () => {
      setRunResult(null);
      const res = await runCodeAction(exerciseId, code, language, stdin);
      if (!res.success) { toast.error(res.error); return; }
      setRunResult(res.result);
    });
  }

  function handleSubmit() {
    const codeToSubmit = isWeb ? JSON.stringify(webCode) : code;
    startSub(async () => {
      const res = await submitExerciseAction(exerciseId, codeToSubmit, language);
      if (!res.success) { toast.error(res.error); return; }
      toast.success('Đã nộp bài! Giáo viên sẽ xem và chấm điểm.');
      const newSub: SubSummary = {
        id: res.submissionId,
        status: 'MANUAL_REVIEW',
        score: null, maxScore: null,
        submittedAt: new Date(),
        attemptNumber: (subs[0]?.attemptNumber ?? 0) + 1,
        language,
      };
      setSubs((prev) => [newSub, ...prev]);
    });
  }

  function handleViewSub(subId: string) {
    setActiveSubId(subId);
    setActiveSub(null);
    startView(async () => {
      const sub = await getExerciseSubmissionAction(subId);
      setActiveSub(sub);
    });
  }

  const canRun    = !isWeb && code.trim().length > 0;
  const canSubmit = isWeb
    ? webCode.html.trim().length > 0 || webCode.css.trim().length > 0 || webCode.js.trim().length > 0
    : code.trim().length > 0;

  return (
    <div className="space-y-5">

      {isWeb ? (
        <div className="rounded-xl p-[1px] bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent shadow-sm">
          <div className="rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e] border-transparent">
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
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 40%)' }}
              >
                {subPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
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
        <div className="flex flex-col lg:flex-row gap-5 items-stretch">
          {/* Left Side: Editor */}
          <div className="flex-1 min-w-0 rounded-xl p-[1px] bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent shadow-sm">
            <div className="h-full rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e] border-transparent">
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
                  {runPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5 fill-current text-[#50fa7b]" />}
                  Chạy
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={runPending || subPending || !canSubmit}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                  style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 40%)' }}
                >
                  {subPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                  Nộp bài
                </button>
              </div>
              
              <div className="flex-1 bg-[#1a1a2e]">
                <CodeEditor value={code} onChange={setCode} language={language} height={560} />
              </div>
            </div>
          </div>

          {/* Right Side: Stdin & Terminal */}
          <div className="w-full lg:w-[450px] xl:w-[500px] flex shrink-0 flex-col gap-5">
            {/* stdin */}
            <div className="rounded-xl p-[1px] bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] shadow-sm flex flex-col">
              <div className="rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e] border-transparent">
                <div className="border-b border-white/10 bg-[#1a1a2e] px-4 py-3 flex-shrink-0">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#f8f8f2]">
                    Dữ liệu vào (stdin)
                  </label>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Nhập dữ liệu đầu vào cho chương trình..."
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-md border border-white/20 bg-[#0d0d1a] px-3 py-2 font-mono text-sm text-[#f8f8f2] focus:outline-none focus:ring-1 focus:ring-[#bd93f9] placeholder:text-[#6272a4]"
                  />
                </div>
              </div>
            </div>

            {/* Terminal */}
            <div className="rounded-xl p-[1px] bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] shadow-sm flex-1 flex flex-col min-h-[250px]">
              <div className="h-full rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e] border-transparent">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 flex-shrink-0">
                  <Terminal className="h-3.5 w-3.5 text-[#7ec8e3]" />
                  <span className="text-xs font-semibold text-[#7ec8e3] uppercase tracking-wider">Output</span>
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
        <div className="rounded-xl border border-border overflow-hidden">
          <p className="border-b border-border px-4 py-2 text-sm font-semibold">Lịch sử nộp bài</p>
          <div className="divide-y divide-border">
            {subs.map((sub) => (
              <div
                key={sub.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors',
                  activeSubId === sub.id && 'bg-muted/30',
                )}
                onClick={() => handleViewSub(sub.id)}
              >
                <span className="w-14 shrink-0 text-xs text-muted-foreground">Lần {sub.attemptNumber}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[sub.status])}>
                  {STATUS_LABEL[sub.status]}
                </span>
                {sub.score != null && sub.maxScore != null && (
                  <span className="text-sm font-semibold tabular-nums">{sub.score}/{sub.maxScore}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{fmt(sub.submittedAt)}</span>
              </div>
            ))}
          </div>

          {/* Loading detail */}
          {viewPending && !activeSub && (
            <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chi tiết...
            </div>
          )}

          {/* Detail panel */}
          {activeSub && (
            <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Chi tiết — Lần {activeSub.attemptNumber}</p>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[activeSub.status])}>
                  {STATUS_LABEL[activeSub.status]}
                  {activeSub.score != null && activeSub.maxScore != null &&
                    ` (${activeSub.score}/${activeSub.maxScore})`}
                </span>
              </div>

              {activeSub.feedback && (
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Nhận xét: </span>{activeSub.feedback}
                </div>
              )}

              {/* WEB: preview */}
              {activeSub.language === 'WEB' && (() => {
                const wc = parseWebCode(activeSub.code);
                return wc ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Code đã nộp (chỉ xem):</p>
                    <WebEditor initialHtml={wc.html} initialCss={wc.css} initialJs={wc.js} readOnly height={420} />
                  </div>
                ) : null;
              })()}

              {/* Non-WEB: read-only code + run */}
              {activeSub.language !== 'WEB' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Code đã nộp (chỉ xem):</p>
                  <div className="rounded-xl border border-border overflow-hidden">
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
    <div className="rounded-xl border border-border overflow-hidden mt-1">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
          Chạy thử code này
        </label>
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
          placeholder="Stdin (tuỳ chọn)..."
          rows={2}
          className="w-full resize-y bg-transparent font-mono text-xs focus:outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <TerminalOutput result={runResult} pending={pending} />
    </div>
  );
}
