'use client';

import { useState, useTransition } from 'react';
import { Play, Loader2, ChevronDown } from 'lucide-react';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { apiClient } from '@/lib/api-client';
import type { SandboxRunResult } from '@lumibach/types';
import { LANGUAGE_ID } from '@/lib/judge0';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────

const LANGUAGES = [
  { key: 'PYTHON3', label: 'Python 3', judgeId: LANGUAGE_ID.PYTHON3 },
  { key: 'JAVASCRIPT', label: 'JavaScript', judgeId: LANGUAGE_ID.JAVASCRIPT },
  { key: 'CPP17', label: 'C++ 17', judgeId: LANGUAGE_ID.CPP17 },
] as const;

type LangKey = (typeof LANGUAGES)[number]['key'];

const STARTER: Record<LangKey, string> = {
  PYTHON3: '# Nhập code Python ở đây\n\n',
  JAVASCRIPT: '// Nhập code JavaScript ở đây\n\n',
  CPP17: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
};

const STATUS_CLASS: Record<number, string> = {
  3: 'text-green-600 dark:text-green-400', // ACCEPTED
  4: 'text-destructive', // WRONG_ANSWER
  5: 'text-amber-600 dark:text-amber-400', // TIME_LIMIT_EXCEEDED
  6: 'text-destructive', // COMPILATION_ERROR
  11: 'text-destructive', // RUNTIME_ERROR
  13: 'text-muted-foreground', // INTERNAL_ERROR
};

// ── Types ─────────────────────────────────────────────────────

type RunResult = ({ success: true } & SandboxRunResult) | { success: false; error: string };

type Props = {
  initialLanguage?: LangKey;
  initialCode?: string;
  lockedLanguage?: boolean;
  height?: number;
};

// ── Component ─────────────────────────────────────────────────

export function CodeRunPanel({
  initialLanguage = 'PYTHON3',
  initialCode,
  lockedLanguage = false,
  height = 420,
}: Props) {
  const [langKey, setLangKey] = useState<LangKey>(initialLanguage);
  const [code, setCode] = useState(initialCode ?? STARTER[initialLanguage]);
  const [stdin, setStdin] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, startRun] = useTransition();

  const lang = LANGUAGES.find((l) => l.key === langKey) ?? LANGUAGES[0]!;

  function handleLangChange(key: LangKey) {
    setLangKey(key);
    if (!initialCode) setCode(STARTER[key]);
    setResult(null);
  }

  function handleRun() {
    startRun(async () => {
      setResult(null);
      try {
        const data = await apiClient.post<SandboxRunResult>('/sandbox/run', {
          languageId: lang.judgeId,
          sourceCode: code,
          stdin,
        });
        setResult({ success: true, ...data });
      } catch (e) {
        setResult({ success: false, error: e instanceof Error ? e.message : 'Có lỗi xảy ra.' });
      }
    });
  }

  // Determine what to show in output area
  const output = (() => {
    if (!result) return null;
    if (!result.success) return { kind: 'error' as const, text: result.error };
    if (result.compileOutput) return { kind: 'compile' as const, text: result.compileOutput };
    if (result.stderr) return { kind: 'stderr' as const, text: result.stderr };
    return { kind: 'stdout' as const, text: result.stdout ?? '' };
  })();

  return (
    <div className="border-border flex flex-col overflow-hidden rounded-xl border">
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-3 py-2">
        {/* Language */}
        <div className="relative">
          <select
            value={langKey}
            onChange={(e) => handleLangChange(e.target.value as LangKey)}
            disabled={lockedLanguage}
            className="border-input bg-background focus:ring-ring cursor-pointer appearance-none rounded-md border py-1 pr-7 pl-3 text-sm focus:ring-1 focus:outline-none disabled:opacity-60"
          >
            {LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
        </div>

        {/* Font size */}
        <div className="relative">
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="border-input bg-background focus:ring-ring cursor-pointer appearance-none rounded-md border py-1 pr-7 pl-3 text-sm focus:ring-1 focus:outline-none"
          >
            {[12, 13, 14, 15, 16, 18, 20].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
          <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          {running ? 'Đang chạy...' : 'Chạy'}
        </button>
      </div>

      {/* ── Main area ──────────────────────────────────────── */}
      <div className="flex min-h-0">
        {/* Editor */}
        <div className="border-border min-w-0 flex-1 border-r">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={langKey}
            fontSize={fontSize}
            height={height}
          />
        </div>

        {/* Right panel: stdin + output */}
        <div className="flex w-72 shrink-0 flex-col">
          {/* Stdin */}
          <div className="border-border border-b">
            <p className="text-muted-foreground px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">
              Input (stdin)
            </p>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Nhập input cho chương trình..."
              rows={5}
              className="w-full resize-none bg-transparent px-3 pb-3 font-mono text-xs focus:outline-none"
            />
          </div>

          {/* Output */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Output
              </p>
              {result?.success && (
                <span
                  className={cn(
                    'text-xs font-semibold',
                    STATUS_CLASS[result.status.id] ?? 'text-muted-foreground'
                  )}
                >
                  {result.status.description}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto px-3 pb-3">
              {running && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang thực thi...
                </div>
              )}
              {!running && output && (
                <pre
                  className={cn(
                    'font-mono text-xs leading-relaxed break-words whitespace-pre-wrap',
                    output.kind === 'stdout' ? 'text-foreground' : 'text-destructive'
                  )}
                >
                  {output.text || (
                    <span className="text-muted-foreground/50 italic">(không có output)</span>
                  )}
                </pre>
              )}
              {!running && !output && (
                <p className="text-muted-foreground/50 text-xs italic">Nhấn Chạy để xem kết quả</p>
              )}
            </div>

            {/* Stats */}
            {result?.success && (result.time || result.memory) && (
              <div className="border-border text-muted-foreground flex items-center gap-3 border-t px-3 py-1.5 text-xs">
                {result.time && <span>⏱ {result.time}s</span>}
                {result.memory && <span>💾 {(result.memory / 1024).toFixed(1)} MB</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
