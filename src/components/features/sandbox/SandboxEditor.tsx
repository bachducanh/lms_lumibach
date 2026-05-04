'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Play, Loader2, Terminal, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, DEFAULT_WEB, type WebCode } from '@/components/features/code/WebEditor';
import { runSandboxAction, type SandboxRunResult } from '@/actions/sandbox';
import { cn } from '@/lib/utils';
import type { CodeLanguage } from '@prisma/client';

// ── Constants ─────────────────────────────────────────────────

const LANGUAGES: {
  key: CodeLanguage;
  label: string;
  icon: string;
  starter: string;
}[] = [
  {
    key:     'PYTHON3',
    label:   'Python 3',
    icon:    '/question_icon/python_icon.png',
    starter: '# Viết code Python của bạn ở đây\nprint("Xin chào!")\n',
  },
  {
    key:     'CPP17',
    label:   'C++ 17',
    icon:    '/question_icon/cplusplus_icon.png',
    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Xin chào!" << endl;\n    return 0;\n}\n',
  },
  {
    key:     'WEB',
    label:   'Web',
    icon:    '/question_icon/web_icon_v2.png',
    starter: '',
  },
];

// ── Terminal panel ─────────────────────────────────────────────

function TerminalPanel({ result, pending }: { result: SandboxRunResult | null; pending: boolean }) {
  const hasError = !!(result?.compileOutput || result?.stderr);

  return (
    <div className="h-full bg-[#1a1a2e] font-mono text-sm px-4 py-3 overflow-auto">
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

// ── Main component ─────────────────────────────────────────────

export function SandboxEditor() {
  const [language, setLanguage] = useState<CodeLanguage>('PYTHON3');
  const [codes,    setCodes]    = useState<Record<string, string>>({
    PYTHON3: '# Viết code Python của bạn ở đây\nprint("Xin chào!")\n',
    CPP17:   '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Xin chào!" << endl;\n    return 0;\n}\n',
  });
  const [stdin,     setStdin]     = useState('');
  const [runResult, setRunResult] = useState<SandboxRunResult | null>(null);
  const [webCode,   setWebCode]   = useState<WebCode>(DEFAULT_WEB);

  const [pending, startRun] = useTransition();

  const isWeb  = language === 'WEB';
  const code   = codes[language] ?? '';

  function setCode(v: string) {
    setCodes((prev) => ({ ...prev, [language]: v }));
  }

  function handleRun() {
    if (isWeb) return;
    if (!code.trim()) return;
    startRun(async () => {
      setRunResult(null);
      const res = await runSandboxAction(code, language, stdin);
      if (!res.success) { toast.error(res.error); return; }
      setRunResult(res.result);
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
      <div className="flex gap-3 flex-wrap">
        {LANGUAGES.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => { setLanguage(l.key); setRunResult(null); }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150',
              language === l.key
                ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                : 'border-border bg-card hover:border-violet-500/40 hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <Image src={l.icon} alt={l.label} width={20} height={20} style={{ width: 20, height: 20 }} />
            {l.label}
          </button>
        ))}
      </div>

      {/* Web editor */}
      {isWeb && (
        <div className="rounded-xl p-[1px] bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent shadow-sm">
          <div className="rounded-xl overflow-hidden bg-[#1a1a2e]">
            <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
              <span className="rounded-md border border-white/20 bg-black/20 px-3 py-1 text-sm font-medium text-[#f8f8f2]">
                Web (HTML + CSS + JS)
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-3 py-1.5 text-xs font-medium text-[#f8f8f2] hover:bg-[#6272a4] transition-colors"
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
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Editor */}
          <div className="flex-1 min-w-0 rounded-xl p-[1px] bg-gradient-to-r from-[#fd085d] via-[oklch(0.80_0.13_210/0.5)] to-transparent shadow-sm flex flex-col">
            <div className="flex-1 rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e]">
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-2.5 py-1.5 text-xs font-medium text-[#f8f8f2] hover:bg-[#6272a4] transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!canRun}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-[#44475a] px-3 py-1.5 text-sm font-medium text-[#f8f8f2] transition-colors hover:bg-[#6272a4] disabled:opacity-50"
                >
                  {pending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5 fill-current text-[#50fa7b]" />}
                  Chạy
                </button>
              </div>
              <div className="flex-1 bg-[#1a1a2e]">
                <CodeEditor value={code} onChange={setCode} language={language} height={480} />
              </div>
            </div>
          </div>

          {/* Right: stdin + output */}
          <div className="w-full lg:w-[420px] xl:w-[460px] flex shrink-0 flex-col gap-4">
            {/* Stdin */}
            <div className="rounded-xl p-[1px] bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] shadow-sm">
              <div className="rounded-xl overflow-hidden bg-[#1a1a2e]">
                <div className="border-b border-white/10 px-4 py-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#f8f8f2]">
                    Dữ liệu vào (stdin)
                  </label>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Nhập dữ liệu đầu vào..."
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-md border border-white/20 bg-[#0d0d1a] px-3 py-2 font-mono text-sm text-[#f8f8f2] focus:outline-none focus:ring-1 focus:ring-[#bd93f9] placeholder:text-[#6272a4]"
                  />
                </div>
              </div>
            </div>

            {/* Output */}
            <div className="rounded-xl p-[1px] bg-gradient-to-r from-transparent via-[oklch(0.80_0.13_210/0.2)] to-[#fd085d] shadow-sm flex-1 flex flex-col min-h-[280px]">
              <div className="flex-1 rounded-xl flex flex-col overflow-hidden bg-[#1a1a2e]">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 shrink-0">
                  <Terminal className="h-3.5 w-3.5 text-[#7ec8e3]" />
                  <span className="text-xs font-semibold text-[#7ec8e3] uppercase tracking-wider flex-1">Output</span>
                  {runResult && (
                    <button
                      type="button"
                      onClick={() => setRunResult(null)}
                      className="text-[#6272a4] hover:text-[#f8f8f2] text-xs transition-colors"
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
