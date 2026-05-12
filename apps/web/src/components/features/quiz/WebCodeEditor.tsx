'use client';

import { useState, useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { defineDraculaTheme } from '@/components/ui/editor/CodeEditor';
import { Code2, Monitor } from 'lucide-react';

type Props = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: number;
};

const EMPTY_PREVIEW = `<p style="color:#888;font-family:sans-serif;padding:16px;font-size:13px">
  Preview sẽ hiện ở đây khi bạn bắt đầu viết code...
</p>`;

// Call emmetHTML once per Monaco instance
const emmetInitialized = { current: false };

export function WebCodeEditor({ value, onChange, readOnly = false, height = 420 }: Props) {
  const [previewHtml, setPreviewHtml] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPreviewHtml(value), 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    defineDraculaTheme(monaco);
    // Configure HTML language service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((monaco.languages as any).html?.htmlDefaults) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (monaco.languages as any).html.htmlDefaults.setOptions({
        suggest: { html5: true },
        format: { tabSize: 2, insertSpaces: true, wrapLineLength: 0 },
      });
    }
  };

  const handleEditorMount: OnMount = (_editor, monaco) => {
    if (emmetInitialized.current) return;
    emmetInitialized.current = true;
    import('emmet-monaco-es')
      .then(({ emmetHTML }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emmetHTML(monaco as any, ['html', 'css']);
      })
      .catch(() => {});
  };

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Header labels */}
      <div className="divide-border border-border bg-muted/30 grid grid-cols-2 divide-x border-b">
        <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
          <Code2 className="h-3 w-3" />
          Code HTML / CSS / JS
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
          <Monitor className="h-3 w-3" />
          Preview (tự động cập nhật)
        </div>
      </div>

      {/* Split pane */}
      <div className="divide-border grid grid-cols-2 divide-x">
        <Editor
          height={height}
          language="html"
          value={value}
          onChange={(v) => onChange?.(v ?? '')}
          theme="dracula"
          beforeMount={handleBeforeMount}
          onMount={handleEditorMount}
          options={{
            fontSize: 14,
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            lineNumbersMinChars: 3,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'line',
            quickSuggestions: { other: true, comments: false, strings: true },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            parameterHints: { enabled: true },
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showFunctions: true,
              showClasses: true,
              showVariables: true,
              showProperties: true,
              showMethods: true,
              showWords: false,
            },
            inlineSuggest: { enabled: true },
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
          }}
          loading={
            <div
              className="bg-muted/20 text-muted-foreground flex items-center justify-center text-sm"
              style={{ height }}
            >
              Đang tải editor...
            </div>
          }
        />
        <iframe
          srcDoc={previewHtml.trim() ? previewHtml : EMPTY_PREVIEW}
          title="Web Preview"
          style={{ height }}
          className="w-full bg-white"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
