/**
 * Kéo lùi 7 tiếng các mốc thời gian đã lưu SAI trước bản fix múi giờ.
 *
 * MẶC ĐỊNH CHẠY THỬ — chỉ in ra bảng đối chiếu, không đụng vào DB. Thêm --apply
 * mới thực sự ghi:
 *
 *   pnpm --filter @lumibach/db db:shift-legacy-dates            # xem trước
 *   pnpm --filter @lumibach/db db:shift-legacy-dates --apply    # thực thi
 *
 * BỐI CẢNH. Form dùng <input type="datetime-local">, cho ra chuỗi giờ treo tường
 * không kèm múi giờ ("2026-08-10T08:00"). API cũ đưa thẳng vào `new Date()`, mà
 * theo chuẩn ECMAScript chuỗi đó được hiểu theo múi giờ của tiến trình — container
 * chạy UTC. Nên "mở từ 8:00" thành 08:00Z tức 15:00 giờ Việt Nam: học sinh vào
 * trước 15:00 vẫn thấy "bài tập chưa mở". Lùi 7 tiếng là đưa về đúng mốc GV định.
 *
 * CHỈ CHẠY MỘT LẦN. Chạy hai lần là lùi 14 tiếng. Script không có cách nào tự
 * nhận ra hàng đã sửa rồi, nên nếu lỡ tay thì phải khôi phục từ bản sao lưu.
 *
 * PHẠM VI. Chỉ những cột do giáo viên nhập tay qua form:
 *   Assignment.availableFrom / dueDate / lateDeadline
 *   Quiz.availableFrom / dueDate
 *   PracticeTest.availableFrom / dueDate
 * KHÔNG đụng các mốc do hệ thống tự ghi (createdAt, submittedAt, gradedAt...):
 * chúng sinh ra từ `new Date()` nên vẫn luôn là instant đúng.
 *
 * CẢNH BÁO. Nếu có hoạt động nào được tạo/sửa SAU khi triển khai bản fix thì mốc
 * của nó đã đúng — lùi thêm sẽ hỏng. Dùng --since để chỉ xử lý hàng cũ, ví dụ
 * `--since 2026-08-10` bỏ qua mọi hàng có updatedAt từ ngày đó trở đi.
 */
import { PrismaClient } from '../generated/client';

const APPLY = process.argv.includes('--apply');
const SHIFT_MS = 7 * 60 * 60 * 1000;

const sinceArg = process.argv.indexOf('--since');
const SINCE = sinceArg !== -1 ? new Date(`${process.argv[sinceArg + 1]}T00:00:00+07:00`) : null;
if (SINCE && Number.isNaN(SINCE.getTime())) {
  console.error('--since phải là ngày dạng YYYY-MM-DD (giờ Việt Nam).');
  process.exit(1);
}

const prisma = new PrismaClient();

const vn = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    : '—';

const shift = (d: Date | null) => (d ? new Date(d.getTime() - SHIFT_MS) : null);

type Row = { id: string; title: string; updatedAt: Date } & Record<string, unknown>;

async function fixTable(
  label: string,
  rows: Row[],
  fields: string[],
  update: (id: string, data: Record<string, Date | null>) => Promise<unknown>
) {
  const touched = rows.filter((r) => fields.some((f) => r[f] != null));
  if (touched.length === 0) {
    console.log(`\n${label}: không có mốc nào cần sửa.`);
    return 0;
  }

  console.log(`\n${label} — ${touched.length} mục:`);
  for (const row of touched) {
    const data: Record<string, Date | null> = {};
    const parts: string[] = [];
    for (const f of fields) {
      const cur = row[f] as Date | null;
      if (cur == null) continue;
      data[f] = shift(cur);
      parts.push(`${f}: ${vn(cur)} → ${vn(data[f])}`);
    }
    console.log(`  · ${row.title}`);
    for (const p of parts) console.log(`      ${p}`);
    if (APPLY) await update(row.id, data);
  }
  return touched.length;
}

async function main() {
  console.log(
    APPLY
      ? '⚠  CHẾ ĐỘ GHI THẬT — lùi 7 tiếng các mốc dưới đây.'
      : 'Chạy thử (dry-run). Thêm --apply để ghi thật.'
  );
  if (SINCE) console.log(`Bỏ qua hàng có updatedAt >= ${vn(SINCE)}.`);

  const notNewer = SINCE ? { updatedAt: { lt: SINCE } } : {};

  const assignments = (await prisma.assignment.findMany({
    where: { deletedAt: null, ...notNewer },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      availableFrom: true,
      dueDate: true,
      lateDeadline: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as unknown as Row[];

  const quizzes = (await prisma.quiz.findMany({
    where: { deletedAt: null, ...notNewer },
    select: { id: true, title: true, updatedAt: true, availableFrom: true, dueDate: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as Row[];

  const practiceTests = (await prisma.practiceTest.findMany({
    where: { deletedAt: null, ...notNewer },
    select: { id: true, title: true, updatedAt: true, availableFrom: true, dueDate: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as Row[];

  let total = 0;
  total += await fixTable(
    'Bài tập',
    assignments,
    ['availableFrom', 'dueDate', 'lateDeadline'],
    (id, data) => prisma.assignment.update({ where: { id }, data })
  );
  total += await fixTable('Quiz', quizzes, ['availableFrom', 'dueDate'], (id, data) =>
    prisma.quiz.update({ where: { id }, data })
  );
  total += await fixTable('Đề luyện tập', practiceTests, ['availableFrom', 'dueDate'], (id, data) =>
    prisma.practiceTest.update({ where: { id }, data })
  );

  console.log(
    `\nTổng: ${total} mục. ${APPLY ? 'Đã ghi xuống DB.' : 'Chưa ghi gì — thêm --apply để thực hiện.'}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
