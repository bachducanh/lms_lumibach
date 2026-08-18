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
const COURSE_ID = 'probe-course';
const COURSE_MODULE_ID = 'probe-course-mod';

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

  // ── Lớp thử + hai học sinh đã nộp bài ─────────────────────────
  // Dùng cho e2e của hai luồng: chép hoạt động từ kho về lớp rồi mở bằng tài
  // khoản học sinh, và màn hình chấm bài khi bấm qua lại giữa hai học sinh.
  const course = await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: {
      id: COURSE_ID,
      name: 'Lớp thử 10E1',
      slug: 'lop-thu-10e1',
      status: 'PUBLISHED',
      categoryId: category.id,
      ownerId: admin.id,
    },
  });

  await prisma.module.upsert({
    where: { id: COURSE_MODULE_ID },
    update: {},
    create: {
      id: COURSE_MODULE_ID,
      courseId: course.id,
      name: 'Chương 1',
      position: 0,
      isPublished: true,
    },
  });

  // Cần ĐÚNG HAI học sinh: lỗi "hiện nhầm bài" chỉ lộ ra khi bấm từ bài người
  // này sang người kia, nên seed gốc với một học sinh là không đủ.
  await prisma.user.upsert({
    where: { email: 'student2@lumibach.local' },
    update: {},
    create: {
      email: 'student2@lumibach.local',
      username: 'student2',
      fullName: 'Lê Văn C',
      firstName: 'C',
      lastName: 'Lê Văn',
      role: 'STUDENT',
      status: 'ACTIVE',
      // Cùng mật khẩu với các tài khoản seed khác (Admin@123).
      passwordHash: admin.passwordHash,
      emailVerified: new Date(),
    },
  });

  const hocSinh = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    orderBy: { createdAt: 'asc' },
    take: 2,
  });
  for (const hs of hocSinh) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: hs.id, courseId: course.id } },
      update: {},
      create: { userId: hs.id, courseId: course.id },
    });
  }

  // Bài tập của LỚP (khác bản mẫu trong kho) + bài nộp của từng học sinh, mỗi
  // bài một nội dung riêng để e2e phát hiện được khi màn hình hiện nhầm bài.
  const baiTap = await prisma.assignment.upsert({
    where: { id: 'probe-course-asg' },
    update: {},
    create: {
      id: 'probe-course-asg',
      courseId: course.id,
      title: 'Bài tập chấm thử',
      instructions: '<p>Viết một đoạn ngắn.</p>',
      status: 'PUBLISHED',
      createdBy: admin.id,
    },
  });

  await prisma.moduleItem.upsert({
    where: { id: 'probe-course-item-asg' },
    update: {},
    create: {
      id: 'probe-course-item-asg',
      moduleId: COURSE_MODULE_ID,
      type: 'ASSIGNMENT',
      position: 0,
      title: baiTap.title,
      assignmentId: baiTap.id,
      isPublished: true,
    },
  });

  for (const [i, hs] of hocSinh.entries()) {
    await prisma.submission.upsert({
      where: { id: `probe-sub-${i}` },
      update: {},
      create: {
        id: `probe-sub-${i}`,
        assignmentId: baiTap.id,
        studentId: hs.id,
        content: `<p>BAI-LAM-CUA-HOC-SINH-${i + 1}</p>`,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: i === 0 ? 7 : null,
        feedback: i === 0 ? 'Nhan xet cho hoc sinh 1' : null,
      },
    });
  }

  // ── Cây danh mục để kiểm PHẠM VI của ngân hàng ────────────────
  //   Trường
  //     ├─ Khối 10 ── 10E1   (lớp đang xét)
  //     └─ Khối 12 ── 12A5   (nhánh anh em — không được lọt vào tầm nhìn)
  // Mỗi tầng có một kho riêng, tên kho trùng tên chương để nhận ra ngay trên
  // giao diện là nội dung đến từ tầng nào.
  const cay: [string, string, string | null][] = [
    ['sc-truong', 'Trường', null],
    ['sc-k10', 'Khối 10', 'sc-truong'],
    ['sc-k12', 'Khối 12', 'sc-truong'],
    ['sc-10e1', '10E1', 'sc-k10'],
    ['sc-12a5', '12A5', 'sc-k12'],
  ];
  for (const [id, name, parentId] of cay) {
    await prisma.courseCategory.upsert({
      where: { id },
      update: { parentId },
      create: { id, name, slug: id, parentId },
    });
  }

  const lopScope = await prisma.course.upsert({
    where: { id: 'sc-course-10e1' },
    update: { categoryId: 'sc-10e1' },
    create: {
      id: 'sc-course-10e1',
      name: 'Tin 10E1',
      slug: 'tin-10e1',
      status: 'PUBLISHED',
      categoryId: 'sc-10e1',
      ownerId: admin.id,
    },
  });

  // Phải có ít nhất một chương, nếu không trang ngân hàng chỉ hiện lời nhắc
  // "chưa có chương nào để nhận nội dung" và không kiểm được gì.
  await prisma.module.upsert({
    where: { id: 'sc-course-mod' },
    update: {},
    create: {
      id: 'sc-course-mod',
      courseId: lopScope.id,
      name: 'Chương 1',
      position: 0,
      isPublished: true,
    },
  });

  for (const [id, bankCategoryId, ten] of [
    ['sc-mod-truong', 'sc-truong', 'KHO-TRUONG'],
    ['sc-mod-k10', 'sc-k10', 'KHO-KHOI-10'],
    ['sc-mod-k12', 'sc-k12', 'KHO-KHOI-12'],
    ['sc-mod-12a5', 'sc-12a5', 'KHO-12A5'],
  ] as const) {
    await prisma.module.upsert({
      where: { id },
      update: {},
      create: { id, bankCategoryId, name: ten, position: 0, createdBy: admin.id },
    });
    const bai = await prisma.lesson.upsert({
      where: { id: `${id}-lesson` },
      update: {},
      create: { id: `${id}-lesson`, title: ten, content: '<p>x</p>', createdBy: admin.id },
    });
    await prisma.moduleItem.upsert({
      where: { id: `${id}-item` },
      update: {},
      create: {
        id: `${id}-item`,
        moduleId: id,
        type: 'LESSON',
        position: 0,
        title: ten,
        lessonId: bai.id,
        isPublished: true,
      },
    });
  }

  console.log(`✅ Kho thử sẵn sàng: /question-banks/${CATEGORY_ID}/content`);
  console.log('✅ Cây kiểm phạm vi sẵn sàng: /courses/tin-10e1/modules/bank');
  console.log(`✅ Lớp thử sẵn sàng: /courses/lop-thu-10e1  (${hocSinh.length} học sinh đã nộp)`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
