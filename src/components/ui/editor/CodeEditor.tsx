'use client';

import { useTheme } from 'next-themes';
import Editor, { useMonaco } from '@monaco-editor/react';

// Map từ language key của app sang Monaco language ID
const MONACO_LANG: Record<string, string> = {
  PYTHON3:    'python',
  JAVASCRIPT: 'javascript',
  CPP17:      'cpp',
};

type Props = {
  value:      string;
  onChange?:  (value: string) => void;
  language:   string;   // key như 'PYTHON3', hoặc trực tiếp Monaco lang như 'html', 'css'
  readOnly?:  boolean;
  height?:    string | number;
  fontSize?:  number;
};

export const defineDraculaTheme = (monaco: any) => {
  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { background: '1a1a2e' },
      { token: 'comment', foreground: '6272a4' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'identifier', foreground: 'f8f8f2' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'class', foreground: '50fa7b' },
      // Web tokens
      { token: 'tag', foreground: 'ff79c6' },
      { token: 'attribute.name', foreground: '50fa7b' },
      { token: 'attribute.value', foreground: 'f1fa8c' },
      { token: 'property', foreground: '8be9fd' },
      { token: 'property.name', foreground: '8be9fd' },
      { token: 'string.html', foreground: 'f1fa8c' },
      { token: 'string.css', foreground: 'f1fa8c' },
      { token: 'string.js', foreground: 'f1fa8c' },
    ],
    colors: {
      'editor.background': '#1a1a2e',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f2',
      'editor.selectionBackground': '#44475a',
      'editor.inactiveSelectionBackground': '#44475a80',
      'editor.lineHighlightBackground': '#44475a80',
      'editorWidget.background': '#1a1a2e',
      'editorSuggestWidget.background': '#1a1a2e',
      'editorSuggestWidget.border': '#44475a',
      'editorSuggestWidget.selectedBackground': '#44475a',
    }
  });
};

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly  = false,
  height    = 400,
  fontSize  = 14,
}: Props) {
  const { resolvedTheme } = useTheme();
  const monacoLang = MONACO_LANG[language] ?? language;

  return (
    <Editor
      height={height}
      language={monacoLang}
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      theme="dracula"
      beforeMount={defineDraculaTheme}
      options={{
        fontSize,
        readOnly,
        minimap:             { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap:            'on',
        automaticLayout:     true,
        tabSize:             4,
        lineNumbersMinChars: 3,
        padding:             { top: 8, bottom: 8 },
        renderLineHighlight: 'line',
        // IntelliSense / autocomplete
        quickSuggestions:           { other: true, comments: false, strings: true },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter:    'on',
        tabCompletion:              'on',
        parameterHints:             { enabled: true, cycle: true },
        suggest: {
          showKeywords:   true,
          showSnippets:   true,
          showFunctions:  true,
          showClasses:    true,
          showVariables:  true,
          showModules:    true,
          showProperties: true,
          showMethods:    true,
        },
        inlineSuggest: { enabled: true },
        bracketPairColorization: { enabled: true },
        formatOnPaste: true,
        formatOnType:  true,
      }}
      loading={
        <div className="flex h-full items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          Đang tải editor...
        </div>
      }
    />
  );
}
