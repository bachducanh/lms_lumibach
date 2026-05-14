'use client';

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure workers BEFORE the monaco instance is used.
// Without this, @monaco-editor/react would try to fetch Monaco from CDN
// (jsDelivr) which can be blocked in restricted networks.
if (typeof window !== 'undefined') {
  (self as unknown as Record<string, unknown>).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url)
        );
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url));
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url)
        );
      }
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url)
        );
      }
      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url));
    },
  };
}

loader.config({ monaco });
