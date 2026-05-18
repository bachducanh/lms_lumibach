'use client';

import { useState, useTransition } from 'react';
import { Play, Loader2, Terminal, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, DEFAULT_WEB, type WebCode } from '@/components/features/code/WebEditor';
import { apiClient } from '@/lib/api-client';
import { SANDBOX_LANGUAGE_ID, type SandboxRunResult } from '@lumibach/types';
import { cn } from '@/lib/utils';
import type { CodeLanguage } from '@lumibach/db';

// ── Constants ─────────────────────────────────────────────────

const LANGUAGES: {
  key: CodeLanguage;
  label: string;
  starter: string;
}[] = [
  {
    key: 'PYTHON3',
    label: 'Python 3',
    starter: '# Viết code Python của bạn ở đây\nprint("Xin chào!")\n',
  },
  {
    key: 'CPP17',
    label: 'C++ 17',
    starter:
      '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Xin chào!" << endl;\n    return 0;\n}\n',
  },
  {
    key: 'WEB',
    label: 'Web',
    starter: '',
  },
];

// ── Terminal panel ─────────────────────────────────────────────

function TerminalPanel({ result, pending }: { result: SandboxRunResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);

  return (
    <div className="h-full overflow-auto bg-[#1a1a2e] px-4 py-3 font-mono text-sm">
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
          {result.stdout && (
            <pre className="text-xs whitespace-pre-wrap text-[#c8f7c5]">{result.stdout}</pre>
          )}
          {!hasError && !result.stdout && (
            <span className="text-xs text-[#555577] italic">(không có output)</span>
          )}
          <div className="flex items-center gap-3 border-t border-white/5 pt-1 text-xs text-[#555577]">
            <span>{result.status.description}</span>
            {result.time && <span>⏱ {result.time}s</span>}
            {result.memory && <span>💾 {(result.memory / 1024).toFixed(1)} MB</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function SandboxEditor() {
  const [language, setLanguage] = useState<CodeLanguage>('PYTHON3');
  const [codes, setCodes] = useState<Record<string, string>>({
    PYTHON3: '# Viết code Python của bạn ở đây\nprint("Xin chào!")\n',
    CPP17:
      '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Xin chào!" << endl;\n    return 0;\n}\n',
  });
  const [stdin, setStdin] = useState('');
  const [runResult, setRunResult] = useState<SandboxRunResult | null>(null);
  const [webCode, setWebCode] = useState<WebCode>(DEFAULT_WEB);

  const [pending, startRun] = useTransition();

  const isWeb = language === 'WEB';
  const code = codes[language] ?? '';

  function setCode(v: string) {
    setCodes((prev) => ({ ...prev, [language]: v }));
  }

  function handleRun() {
    if (isWeb) return;
    if (!code.trim()) return;
    startRun(async () => {
      setRunResult(null);
      try {
        const result = await apiClient.post<SandboxRunResult>('/sandbox/run', {
          languageId: SANDBOX_LANGUAGE_ID[language as keyof typeof SANDBOX_LANGUAGE_ID],
          sourceCode: code,
          stdin,
        });
        setRunResult(result);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  function handleReset() {
    const lang = LANGUAGES.find((l) => l.key === language);
    if (!lang) return;
    if (isWeb) {
      setWebCode(DEFAULT_WEB);
    } else {
      setCode(lang.starter);
      setRunResult(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }

  const canRun = !isWeb && code.trim().length > 0 && !pending;

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Language selector */}
      <div className="flex flex-wrap gap-3">
        {LANGUAGES.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => {
              setLanguage(l.key);
              setRunResult(null);
            }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150',
              language === l.key
                ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                : 'border-border bg-card hover:bg-muted/50 text-muted-foreground hover:border-violet-500/40'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Web editor */}
      {isWeb && (
        <div className="rounded-xl bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent p-[1px] shadow-sm">
          <div className="overflow-hidden rounded-xl bg-[#1a1a2e]">
            <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
              <span className="rounded-md border border-white/20 bg-black/20 px-3 py-1 text-sm font-medium text-[#f8f8f2]">
                Web (HTML + CSS + JS)
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-3 py-1.5 text-xs font-medium text-[#f8f8f2] transition-colors hover:bg-[#6272a4]"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <WebEditor
              initialHtml={webCode.html}
              initialCss={webCode.css}
              initialJs={webCode.js}
              onChange={setWebCode}
              height={580}
            />
          </div>
        </div>
      )}

      {/* Code + terminal layout */}
      {!isWeb && (
        <div className="flex flex-col items-stretch gap-4 lg:flex-row">
          {/* Editor */}
          <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent p-[1px] shadow-sm">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-[#1a1a2e]">
              {/* Toolbar */}
              <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
                <span className="rounded-md border border-white/20 bg-black/20 px-3 py-1 text-sm font-medium text-[#f8f8f2]">
                  {LANGUAGES.find((l) => l.key === language)?.label}
                </span>
                <span className="text-[10px] text-[#6272a4]">Ctrl+Enter để chạy</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-2.5 py-1.5 text-xs font-medium text-[#f8f8f2] transition-colors hover:bg-[#6272a4]"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!canRun}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-3 py-1.5 text-sm font-medium text-[#f8f8f2] transition-colors hover:bg-[#6272a4] disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current text-[#50fa7b]" />
                  )}
                  Chạy
                </button>
              </div>
              <div className="flex-1 bg-[#1a1a2e]">
                <CodeEditor value={code} onChange={setCode} language={language} height={480} />
              </div>
            </div>
          </div>

          {/* Right: stdin + output */}
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[420px] xl:w-[460px]">
            {/* Stdin */}
            <div className="rounded-xl bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] p-[1px] shadow-sm">
              <div className="overflow-hidden rounded-xl bg-[#1a1a2e]">
                <div className="border-b border-white/10 px-4 py-3">
                  <label className="text-xs font-semibold tracking-wide text-[#f8f8f2] uppercase">
                    Dữ liệu vào (stdin)
                  </label>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Nhập dữ liệu đầu vào..."
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-md border border-white/20 bg-[#0d0d1a] px-3 py-2 font-mono text-sm text-[#f8f8f2] placeholder:text-[#6272a4] focus:ring-1 focus:ring-[#bd93f9] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Output */}
            <div className="flex min-h-[280px] flex-1 flex-col rounded-xl bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] p-[1px] shadow-sm">
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-[#1a1a2e]">
                <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2">
                  <Terminal className="h-3.5 w-3.5 text-[#7ec8e3]" />
                  <span className="flex-1 text-xs font-semibold tracking-wider text-[#7ec8e3] uppercase">
                    Output
                  </span>
                  {runResult && (
                    <button
                      type="button"
                      onClick={() => setRunResult(null)}
                      className="text-xs text-[#6272a4] transition-colors hover:text-[#f8f8f2]"
                    >
                      Xoá
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  <TerminalPanel result={runResult} pending={pending} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
