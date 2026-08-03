#!/usr/bin/env node
// Windows: prisma generate ghi đè query_engine-windows.dll.node, nhưng nếu
// dev server (web/api) đang chạy thì file đó đang bị khoá -> EPERM.
// Script này dừng process đang giữ port của web/api trước, rồi mới generate.
import { execSync, spawnSync } from 'node:child_process';

const PORTS = [3000, 4000];

function killPort(port) {
  let output;
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  } catch {
    return; // không có process nào đang dùng port này
  }

  const pids = new Set();
  for (const line of output.split('\n')) {
    const match = line.trim().match(/LISTENING\s+(\d+)\s*$/);
    if (match) pids.add(match[1]);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`[db:generate:safe] Đã dừng process PID ${pid} đang giữ port ${port}`);
    } catch {
      // process đã tự thoát giữa lúc netstat và taskkill — bỏ qua
    }
  }
}

for (const port of PORTS) killPort(port);

const result = spawnSync('pnpm', ['exec', 'prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
