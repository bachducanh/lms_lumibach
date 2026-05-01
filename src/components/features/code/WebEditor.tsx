'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Globe } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { defineDraculaTheme } from '@/components/ui/editor/CodeEditor';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────

type Tab = 'html' | 'css' | 'js';

export type WebCode = { html: string; css: string; js: string };

// ── Defaults ──────────────────────────────────────────────────

export const DEFAULT_WEB: WebCode = {
  html: `<h1>Xin chào!</h1>\n<p>Chỉnh sửa HTML, CSS và JavaScript bên trái để xem kết quả.</p>`,
  css:  `* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  font-family: sans-serif;\n  padding: 24px;\n  line-height: 1.6;\n}\nh1 { color: #2563eb; margin-bottom: 8px; }`,
  js:   `// JavaScript của bạn ở đây\nconsole.log('Hello!');`,
};

// ── File tab config ───────────────────────────────────────────

const TABS: { id: Tab; filename: string; lang: string; accent: string }[] = [
  { id: 'html', filename: 'index.html', lang: 'html',       accent: '#e44d26' },
  { id: 'css',  filename: 'style.css',  lang: 'css',        accent: '#264de4' },
  { id: 'js',   filename: 'script.js',  lang: 'javascript', accent: '#f7df1e' },
];

// ── Monaco options — VS Code-like ─────────────────────────────

const BASE_OPTIONS = {
  fontSize:             14,
  minimap:              { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout:      true,
  tabSize:              2,             // web convention: 2 spaces
  insertSpaces:         true,
  lineNumbersMinChars:  3,
  padding:              { top: 8, bottom: 8 },
  renderLineHighlight:  'line'   as const,
  // ── Suggestions ─────────────────────────────────────────────
  quickSuggestions:          { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter:   'on' as const,
  tabCompletion:             'on' as const,
  wordBasedSuggestions:      'off' as const,
  // ── Format ──────────────────────────────────────────────────
  formatOnType:              true,
  formatOnPaste:             true,
  autoIndent:                'full' as const,
  // ── Brackets & quotes ───────────────────────────────────────
  autoClosingBrackets:       'always' as const,
  autoClosingQuotes:         'always' as const,
  autoSurround:              'languageDefined' as const,
  matchBrackets:             'always' as const,
  bracketPairColorization:   { enabled: true },
  // ── Folding ─────────────────────────────────────────────────
  folding:                   true,
  showFoldingControls:       'mouseover' as const,
  // ── Links ───────────────────────────────────────────────────
  links:                     true,
  // ── Scrollbar ───────────────────────────────────────────────
  scrollbar:                 { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
} as const;

// ── Emmet registration (once per page) ───────────────────────

let emmetReady = false;

function registerEmmetAndTheme(monaco: Parameters<NonNullable<Parameters<typeof Editor>[0]['beforeMount']>>[0]) {
  defineDraculaTheme(monaco);
  if (emmetReady) return;
  emmetReady = true;
  import('emmet-monaco-es').then(({ emmetHTML, emmetCSS }) => {
    emmetHTML(monaco as any);
    emmetCSS(monaco as any);
  }).catch(() => {/* graceful degradation */});
}

// ── Props ─────────────────────────────────────────────────────

type Props = {
  initialHtml?: string;
  initialCss?:  string;
  initialJs?:   string;
  readOnly?:    boolean;
  height?:      number;
  onChange?:    (code: WebCode) => void;
};

// ── Component ─────────────────────────────────────────────────

export function WebEditor({
  initialHtml = DEFAULT_WEB.html,
  initialCss  = DEFAULT_WEB.css,
  initialJs   = DEFAULT_WEB.js,
  readOnly    = false,
  height      = 580,
  onChange,
}: Props) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = 'dracula';

  const [tab,  setTab]  = useState<Tab>('html');
  const [html, setHtml] = useState(initialHtml);
  const [css,  setCss]  = useState(initialCss);
  const [js,   setJs]   = useState(initialJs);
  const [auto, setAuto] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const firstRef  = useRef(true);

  // ── Build full document ────────────────────────────────────

  function buildDoc(h: string, c: string, j: string) {
    return [
      '<!DOCTYPE html>',
      '<html lang="vi">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<style>${c}</style>`,
      '</head>',
      '<body>',
      h,
      '<script>',
      `try{${j}}catch(e){`,
      `  var el=document.createElement('pre');`,
      `  el.style.cssText='color:#dc2626;padding:12px;background:#fee2e2;border-radius:6px;margin:8px;font-size:13px;white-space:pre-wrap';`,
      `  el.textContent='JS Error: '+e;`,
      `  document.body.appendChild(el);`,
      `}`,
      '<\/script>',
      '</body>',
      '</html>',
    ].join('\n');
  }

  function applyDoc() {
    if (iframeRef.current) iframeRef.current.srcdoc = buildDoc(html, css, js);
  }

  // ── Auto-refresh debounce ──────────────────────────────────

  useEffect(() => {
    if (!auto) return;
    const delay = firstRef.current ? 0 : 500;
    firstRef.current = false;
    const t = setTimeout(applyDoc, delay);
    return () => clearTimeout(t);
  }, [html, css, js, auto]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify parent ──────────────────────────────────────────

  useEffect(() => {
    onChange?.({ html, css, js });
  }, [html, css, js]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layout ────────────────────────────────────────────────

  const TAB_H   = 38;
  const editorH = height - TAB_H;

  const vals: Record<Tab, { v: string; set: (s: string) => void }> = {
    html: { v: html, set: setHtml },
    css:  { v: css,  set: setCss  },
    js:   { v: js,   set: setJs   },
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden w-full" style={{ height }}>

      {/* ── Left: Editor ──────────────────────────────────── */}
      <div className="flex flex-col w-1/2 min-w-0 border-r border-white/10">

        {/* VS Code-style file tabs */}
        <div className="flex shrink-0 bg-[#161625] overflow-x-auto" style={{ height: TAB_H }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 h-full text-xs font-medium whitespace-nowrap border-r border-white/10 transition-colors',
                  active
                    ? 'bg-[#1a1a2e] text-[#f8f8f2]'
                    : 'text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#1a1a2e]/50',
                )}
              >
                {/* Accent top bar on active tab */}
                {active && (
                  <span
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: t.accent }}
                  />
                )}
                {/* Colored dot */}
                <span
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ background: t.accent, opacity: active ? 1 : 0.5 }}
                />
                {t.filename}
              </button>
            );
          })}
        </div>

        {/* Monaco editors — Emmet + full IntelliSense */}
        {TABS.map((t) => (
          <div key={t.id} className={tab === t.id ? 'block' : 'hidden'}>
            <Editor
              height={editorH}
              language={t.lang}
              value={vals[t.id].v}
              onChange={(v) => !readOnly && vals[t.id].set(v ?? '')}
              theme={monacoTheme}
              options={{ ...BASE_OPTIONS, readOnly }}
              beforeMount={registerEmmetAndTheme}
              loading={
                <div className="flex h-full items-center justify-center bg-muted/20 text-sm text-muted-foreground">
                  Đang tải editor...
                </div>
              }
            />
          </div>
        ))}
      </div>

      {/* ── Right: Live preview ───────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Preview toolbar */}
        <div
          className="flex shrink-0 items-center gap-2 px-3 bg-[#161625] border-b border-white/10"
          style={{ height: TAB_H }}
        >
          <Globe className="h-3.5 w-3.5 text-[#6272a4]" />
          <span className="flex-1 text-xs font-medium text-[#6272a4]">Preview</span>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#6272a4] select-none">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            Auto
          </label>

          {!auto && (
            <button
              type="button"
              onClick={applyDoc}
              title="Cập nhật preview"
              className="rounded p-1 text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#1a1a2e] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <iframe
          ref={iframeRef}
          title="web-preview"
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          className="flex-1 w-full bg-white"
        />
      </div>
    </div>
  );
}
