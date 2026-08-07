// Chuyển .env giữa hồ sơ dev (localhost) và prod (máy chủ thật).
//
//   pnpm env:dev     → .env.dev  → .env
//   pnpm env:prod    → .env.prod → .env
//   pnpm env:which   → chỉ xem đang dùng hồ sơ nào, không đổi gì
//
// Vì sao cần: .env.prod trỏ vào DB thật ở 192.168.53.101 có bài nộp của học
// sinh. Chạy `pnpm dev` khi đang ở hồ sơ prod là sửa code trên dữ liệu thật —
// xoá nhầm một khoá học lúc thử nghiệm là mất thật, không có bản nháp nào cả.
//
// Viết bằng Node thay vì `cp`/`copy` để chạy được cả PowerShell lẫn bash.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';

const profile = process.argv[2];
const ENV = '.env';

/** Đọc một biến từ file .env, trả về null nếu không có. */
function readVar(file, key) {
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

/** Che mật khẩu trong chuỗi kết nối trước khi in ra màn hình. */
function mask(url) {
  return url ? url.replace(/\/\/([^:@/]+):[^@]*@/, '//$1:***@') : '(trống)';
}

/** In hồ sơ hiện tại bằng cách so .env với các file mẫu. */
function report() {
  if (!existsSync(ENV)) {
    console.log('Chưa có .env. Chạy: pnpm env:dev');
    return;
  }
  const current = readFileSync(ENV, 'utf8');
  const match = ['dev', 'prod'].find(
    (p) => existsSync(`.env.${p}`) && readFileSync(`.env.${p}`, 'utf8') === current
  );

  const label =
    match === 'prod' ? 'PROD — DỮ LIỆU THẬT' : match === 'dev' ? 'DEV — localhost' : 'TỰ SỬA TAY';
  console.log(`\n  Hồ sơ:    ${label}`);
  console.log(`  Database: ${mask(readVar(ENV, 'DATABASE_URL'))}`);
  console.log(`  MinIO:    ${readVar(ENV, 'MINIO_INTERNAL_ENDPOINT') ?? '(trống)'}`);

  if (match === 'prod') {
    console.log('\n  ⚠ ĐỪNG chạy `pnpm dev` ở hồ sơ này — mọi thao tác thử');
    console.log('    nghiệm sẽ ghi thẳng vào dữ liệu học sinh.');
    console.log('    Chuyển về dev:  pnpm env:dev\n');
  } else {
    console.log('');
  }
}

if (!profile || profile === 'which') {
  report();
  process.exit(0);
}

const source = `.env.${profile}`;
if (!existsSync(source)) {
  console.error(`Không thấy ${source}. Chỉ có hai hồ sơ: dev, prod.`);
  process.exit(1);
}

copyFileSync(source, ENV);
console.log(`Đã chép ${source} → ${ENV}`);
report();
