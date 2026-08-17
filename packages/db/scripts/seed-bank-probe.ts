/**
 * Dữ liệu tối thiểu cho e2e của Kho nội dung (apps/web/e2e/content-bank.spec.ts):
 * một danh mục khoá học, một chương trong kho, và một bài giảng để bấm thử.
 *
 *   pnpm --filter @lumibach/db db:seed-bank-probe
 *
 * Chạy nhiều lần vô hại (upsert theo id cố định). CHỈ dùng cho DB dev/test —
 * script tự chặn nếu DATABASE_URL trỏ ra ngoài localhost, vì id ở đây cố định
 * và rất dễ đụng dữ liệu thật nếu chạy nhầm hồ sơ.
 */
import { PrismaClient } from '@lumibach/db';

const prisma = new PrismaClient();

const CATEGORY_ID = 'probe-cat';
const MODULE_ID = 'probe-mod';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      'Từ chối chạy: DATABASE_URL không trỏ tới localhost. Script này chỉ dành cho DB dev/test.'
    );
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Chưa có tài khoản ADMIN — chạy `pnpm db:seed` trước.');

  const category = await prisma.courseCategory.upsert({
    where: { id: CATEGORY_ID },
    update: {},
    create: { id: CATEGORY_ID, name: 'Tin học (thử)', slug: 'tin-hoc-thu' },
  });

  await prisma.module.upsert({
    where: { id: MODULE_ID },
    update: {},
    create: {
      id: MODULE_ID,
      bankCategoryId: category.id,
      name: 'Chủ đề A (thử)',
      position: 0,
      createdBy: admin.id,
    },
  });

  const lesson = await prisma.lesson.upsert({
    where: { id: 'probe-lesson' },
    update: {},
    create: {
      id: 'probe-lesson',
      title: 'Bài giảng thử',
      content: '<p>nội dung thử</p>',
      createdBy: admin.id,
    },
  });

  await prisma.moduleItem.upsert({
    where: { id: 'probe-item-lesson' },
    update: {},
    create: {
      id: 'probe-item-lesson',
      moduleId: MODULE_ID,
      type: 'LESSON',
      position: 0,
      title: 'Bài giảng thử',
      lessonId: lesson.id,
      isPublished: true,
    },
  });

  console.log(`✅ Kho thử sẵn sàng: /question-banks/${CATEGORY_ID}/content`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
