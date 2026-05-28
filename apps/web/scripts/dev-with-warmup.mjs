#!/usr/bin/env node
/**
 * Wrapper cho `next dev` + warmup route registration.
 *
 * Lý do: Next.js 16 (Turbopack) ở project có nhiều page lồng dynamic
 * thường BỎ SÓT một số route khi scan filesystem lúc startup —
 * vd `[slug]/quizzes/[quizId]/attempt/[attemptId]`, `/edit`,
 * `/submissions`. Hit vào những URL đó trả 404 vì Turbopack không
 * khớp được pattern dù file tồn tại. Touch file trước khi `next dev`
 * chạy KHÔNG ăn — phải touch SAU khi server ready để file watcher
 * mới đăng ký route.
 *
 * Script này:
 *  1. Spawn `next dev` (forward args)
 *  2. Poll http://localhost:<port>/ tới khi server trả response
 *  3. Touch toàn bộ page.tsx/route.ts/layout.tsx... trong app/
 *     → HMR đăng ký mọi route
 *  4. Forward signals (Ctrl-C, SIGTERM) và exit code của next dev
 *
 * Có thể gỡ khi Next.js fix bug upstream.
 */
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { readdir, utimes } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..', 'src', 'app');

// Cổng dev — đọc từ args nếu có (-p / --port), mặc định 3000.
function detectPort(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-p' || a === '--port') return Number(args[i + 1]) || 3000;
    const m = /^--port=(\d+)$/.exec(a);
    if (m) return Number(m[1]);
  }
  return Number(process.env.PORT) || 3000;
}

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

async function touchAll(dir) {
  let count = 0;
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        await walk(full);
      } else if (ROUTE_FILES.has(entry.name)) {
        const now = new Date();
        try {
          await utimes(full, now, now);
          count += 1;
        } catch {
          /* ignore */
        }
      }
    }
  }
  await walk(dir);
  return count;
}

function ping(port) {
  return new Promise((resolvePromise) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        method: 'HEAD',
        timeout: 1500,
      },
      (res) => {
        res.resume();
        // Bất kỳ HTTP response nào (kể cả 404/302/401) đều OK — server đang lắng nghe.
        resolvePromise(res.statusCode != null && res.statusCode > 0);
      }
    );
    req.on('error', () => resolvePromise(false));
    req.on('timeout', () => {
      req.destroy();
      resolvePromise(false);
    });
    req.end();
  });
}

const args = process.argv.slice(2);
const port = detectPort(args);

const nextArgs = ['next', 'dev', ...args];
const child = spawn('pnpm', ['exec', ...nextArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

let warmedUp = false;
async function warmupLoop() {
  // Chờ tối đa ~60s để server ready, sau đó touch.
  for (let i = 0; i < 120; i++) {
    await wait(500);
    if (await ping(port)) {
      // Server lên — thêm chút thời gian cho Next.js settle, rồi touch.
      await wait(1500);
      const n = await touchAll(APP_DIR);
      process.stdout.write(
        `\n[dev-warmup] Touched ${n} route file(s) to force Turbopack registration.\n\n`
      );
      warmedUp = true;
      return;
    }
  }
  process.stderr.write('[dev-warmup] Server never answered on port ' + port + ' — skip warmup.\n');
}

warmupLoop().catch((e) => {
  process.stderr.write('[dev-warmup] Error: ' + e.message + '\n');
});

function forward(signal) {
  if (!child.killed) child.kill(signal);
}
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (!warmedUp) {
    process.stderr.write('[dev-warmup] next dev exited before warmup completed.\n');
  }
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
