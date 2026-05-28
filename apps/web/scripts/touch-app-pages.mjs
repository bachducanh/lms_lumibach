#!/usr/bin/env node
/**
 * Workaround cho bug Next.js 16 + Turbopack: ở các project có nhiều page
 * trong app/, một số route lồng động (vd `[slug]/quizzes/[quizId]/edit/`)
 * KHÔNG được index khi `next dev` khởi động, dẫn đến 404 cho đến khi file
 * được sửa (HMR mới đăng ký route).
 *
 * Script này chạy trước `next dev` và "touch" mtime của mọi `page.tsx`,
 * `route.ts`, `layout.tsx`, `default.tsx`, `error.tsx`, `loading.tsx`,
 * `not-found.tsx` trong app/. Mtime mới hơn buộc Turbopack coi chúng là
 * "vừa thay đổi" → file watcher pick up đầy đủ trước khi server ready.
 *
 * Có thể bỏ khi Next.js fix bug ở phiên bản sau.
 */
import { readdir, utimes } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..', 'src', 'app');

const ROUTE_FILES = new Set([
  'page.tsx',
  'page.ts',
  'page.jsx',
  'page.js',
  'route.ts',
  'route.js',
  'layout.tsx',
  'layout.ts',
  'layout.jsx',
  'layout.js',
  'default.tsx',
  'default.ts',
  'error.tsx',
  'error.ts',
  'loading.tsx',
  'loading.ts',
  'not-found.tsx',
  'not-found.ts',
]);

let touched = 0;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and hidden dirs
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await walk(full);
    } else if (ROUTE_FILES.has(entry.name)) {
      const now = new Date();
      try {
        await utimes(full, now, now);
        touched += 1;
      } catch {
        // ignore — best effort
      }
    }
  }
}

await walk(APP_DIR);
console.log(`[touch-app-pages] touched ${touched} route file(s) under ${APP_DIR}`);
