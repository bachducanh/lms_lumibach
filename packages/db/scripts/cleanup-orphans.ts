/**
 * Dọn dữ liệu mồ côi tích tụ TRƯỚC bản fix xoá cascade.
 *
 * MẶC ĐỊNH CHẠY THỬ — chỉ in ra những gì sẽ xoá, không đụng vào DB hay MinIO.
 * Thêm cờ --apply mới thực sự xoá:
 *
 *   pnpm --filter @lumibach/db db:cleanup-orphans            # xem trước
 *   pnpm --filter @lumibach/db db:cleanup-orphans --apply    # thực thi
 *
 * Ba nhóm rác được xử lý:
 *   A. Khoá học nằm trong thùng rác QUÁ 30 ngày → dọn hẳn. (Khoá mới xoá được
 *      giữ nguyên để còn khôi phục — cron /api/cron/purge-trash lo việc này,
 *      script chỉ dùng khi cần chạy tay.)
 *   B. Lesson không còn ModuleItem nào trỏ tới (Lesson không có courseId nên
 *      cascade chưa bao giờ chạm tới nó).
 *   C. ModuleItem trỏ tới bài tập/quiz/đề đã soft-delete → mục "rác" trong chương.
 *   D. Bài tập / quiz / bài code / đề ôn còn sống nhưng KHÔNG chương nào trỏ tới.
 *      Đây là rác tích tụ từ thời xoá mục trong chương không xoá theo nội dung:
 *      chúng biến mất khỏi chương nhưng vẫn nằm ở tab riêng, nhóm "chưa thuộc
 *      chương nào". Nhóm này chỉ soft-delete (vào thùng rác) để còn khôi phục.
 *
 * KHÔNG đụng tới: ảnh chèn trong nội dung rich-text. Chúng có thể nằm rải rác ở
 * nhiều cột (nội dung bài giảng, đề bài, câu hỏi, bài đăng diễn đàn...) nên quét
 * hàng loạt dễ xoá nhầm ảnh còn đang dùng. Cần rà thủ công nếu muốn.
 */
import { PrismaClient } from '../generated/client';
import * as Minio from 'minio';

const APPLY = process.argv.includes('--apply');

// Lesson được tạo rồi mới gắn ModuleItem ở lời gọi kế tiếp (không cùng
// transaction). Bỏ qua lesson vừa tạo để không xoá nhầm bài đang soạn dở.
const LESSON_MIN_AGE_MS = 60 * 60 * 1000;

// Phải khớp TRASH_RETENTION_DAYS ở @lumibach/types (packages/db không phụ thuộc
// package đó nên khai lại ở đây).
const TRASH_RETENTION_DAYS = 30;

const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';
const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';
const KNOWN_BUCKETS = new Set([BUCKET_AVATARS, BUCKET_FILES]);

const prisma = new PrismaClient();

const minio =
  process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY
    ? new Minio.Client({
        endPoint: process.env.MINIO_INTERNAL_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost',
        port: parseInt(process.env.MINIO_INTERNAL_PORT ?? process.env.MINIO_PORT ?? '9000', 10),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
      })
    : null;

/** Giống StorageService.parseUrl — trả null nghĩa là KHÔNG xoá gì. */
function parseUrl(url: string | null | undefined): { bucket: string; objectName: string } | null {
  if (!url) return null;
  let path = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
  }
  const at = path.indexOf('/storage/');
  if (at === -1) return null;
  const rest = path.slice(at + '/storage/'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = decodeURIComponent(rest.slice(0, slash));
  const objectName = decodeURIComponent(rest.slice(slash + 1));
  if (!objectName || !KNOWN_BUCKETS.has(bucket)) return null;
  return { bucket, objectName };
}

async function removeFiles(urls: (string | null)[]): Promise<number> {
  const byBucket = new Map<string, Set<string>>();
  for (const url of urls) {
    const parsed = parseUrl(url);
    if (!parsed) continue;
    const set = byBucket.get(parsed.bucket) ?? new Set<string>();
    set.add(parsed.objectName);
    byBucket.set(parsed.bucket, set);
  }

  let total = 0;
  for (const [, objects] of byBucket) total += objects.size;
  if (!APPLY || !minio) return total;

  for (const [bucket, objects] of byBucket) {
    try {
      await minio.removeObjects(bucket, [...objects]);
    } catch (err) {
      console.warn(`  ! Không xoá được file trong bucket "${bucket}": ${String(err)}`);
    }
  }
  return total;
}

/** File có cột/bản ghi DB riêng nên quy được chủ sở hữu rõ ràng. */
async function collectCourseFileUrls(courseId: string, thumbnail: string | null) {
  const [submissionFiles, quizzes, practiceTests, exercises, scratchSubs] = await Promise.all([
    prisma.submissionFile.findMany({
      where: { submission: { assignment: { courseId } } },
      select: { url: true },
    }),
    prisma.quiz.findMany({
      where: { courseId, sebConfigUrl: { not: null } },
      select: { sebConfigUrl: true },
    }),
    prisma.practiceTest.findMany({
      where: { courseId },
      select: { pdfUrl: true, sebConfigUrl: true },
    }),
    prisma.codeExercise.findMany({
      where: { courseId, starterFileUrl: { not: null } },
      select: { starterFileUrl: true },
    }),
    prisma.codeSubmission.findMany({
      where: { codeExercise: { courseId }, language: 'SCRATCH' },
      select: { code: true },
    }),
  ]);

  return [
    thumbnail,
    ...submissionFiles.map((f) => f.url),
    ...quizzes.map((q) => q.sebConfigUrl),
    ...practiceTests.flatMap((p) => [p.pdfUrl, p.sebConfigUrl]),
    ...exercises.map((e) => e.starterFileUrl),
    ...scratchSubs.map((s) => {
      try {
        return (JSON.parse(s.code) as { sb3Url?: string }).sb3Url ?? null;
      } catch {
        return null;
      }
    }),
  ];
}

/** Lesson của khoá, loại những bài còn được khoá khác dùng chung. */
async function lessonIdsOfCourse(courseId: string): Promise<string[]> {
  const rows = await prisma.moduleItem.findMany({
    where: { module: { courseId }, lessonId: { not: null } },
    select: { lessonId: true },
  });
  const ids = [...new Set(rows.map((r) => r.lessonId as string))];
  if (ids.length === 0) return [];

  const shared = await prisma.moduleItem.findMany({
    where: { lessonId: { in: ids }, module: { courseId: { not: courseId } } },
    select: { lessonId: true },
  });
  const sharedIds = new Set(shared.map((r) => r.lessonId as string));
  return ids.filter((id) => !sharedIds.has(id));
}

// ── A. Khoá học đã soft-delete ────────────────────────────────────────────
async function purgeSoftDeletedCourses() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const courses = await prisma.course.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, name: true, slug: true, thumbnail: true, deletedAt: true },
  });

  const stillInTrash = await prisma.course.count({
    where: { deletedAt: { not: null, gte: cutoff } },
  });

  console.log(
    `\n[A] Khoá học quá hạn ${TRASH_RETENTION_DAYS} ngày trong thùng rác: ${courses.length}`
  );
  if (stillInTrash > 0) {
    console.log(`    (giữ nguyên ${stillInTrash} khoá còn trong hạn — vẫn khôi phục được)`);
  }
  if (courses.length === 0) return { courses: 0, files: 0 };

  let files = 0;
  for (const course of courses) {
    const [modules, assignments, quizzes, enrollments, lessonIds] = await Promise.all([
      prisma.module.count({ where: { courseId: course.id } }),
      prisma.assignment.count({ where: { courseId: course.id } }),
      prisma.quiz.count({ where: { courseId: course.id } }),
      prisma.enrollment.count({ where: { courseId: course.id } }),
      lessonIdsOfCourse(course.id),
    ]);
    const urls = await collectCourseFileUrls(course.id, course.thumbnail);

    console.log(
      `  - "${course.name}" (${course.slug}) — xoá ngày ` +
        `${course.deletedAt?.toISOString().slice(0, 10)}: ` +
        `${modules} chương, ${lessonIds.length} bài giảng, ${assignments} bài tập, ` +
        `${quizzes} quiz, ${enrollments} ghi danh`
    );

    if (APPLY) {
      await prisma.$transaction([
        prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } }),
        prisma.course.delete({ where: { id: course.id } }),
      ]);
    }
    files += await removeFiles(urls);
  }
  return { courses: courses.length, files };
}

// ── B. Lesson không còn ModuleItem nào trỏ tới ────────────────────────────
async function purgeOrphanLessons() {
  const cutoff = new Date(Date.now() - LESSON_MIN_AGE_MS);
  const orphans = await prisma.lesson.findMany({
    where: { moduleItems: { none: {} }, createdAt: { lt: cutoff } },
    select: { id: true, title: true, createdAt: true },
  });

  console.log(`\n[B] Bài giảng mồ côi (không chương nào trỏ tới): ${orphans.length}`);
  if (orphans.length === 0) return { lessons: 0, files: 0 };

  const ids = orphans.map((l) => l.id);
  const attachments = await prisma.lessonAttachment.findMany({
    where: { lessonId: { in: ids } },
    select: { url: true },
  });

  for (const l of orphans.slice(0, 20)) {
    console.log(`  - "${l.title}" (tạo ${l.createdAt.toISOString().slice(0, 10)})`);
  }
  if (orphans.length > 20) console.log(`  ... và ${orphans.length - 20} bài nữa`);
  console.log(`  Kèm ${attachments.length} file đính kèm`);

  if (APPLY) await prisma.lesson.deleteMany({ where: { id: { in: ids } } });
  const files = await removeFiles(attachments.map((a) => a.url));
  return { lessons: orphans.length, files };
}

// ── C. ModuleItem trỏ tới nội dung đã soft-delete ─────────────────────────
async function purgeStaleModuleItems() {
  const stale = await prisma.moduleItem.findMany({
    where: {
      OR: [
        { assignment: { deletedAt: { not: null } } },
        { quiz: { deletedAt: { not: null } } },
        { practiceTest: { deletedAt: { not: null } } },
        { codeExercise: { deletedAt: { not: null } } },
      ],
    },
    select: { id: true, title: true, type: true },
  });

  console.log(`\n[C] Mục rác trong chương (trỏ tới nội dung đã xoá): ${stale.length}`);
  for (const item of stale.slice(0, 20)) console.log(`  - [${item.type}] "${item.title}"`);
  if (stale.length > 20) console.log(`  ... và ${stale.length - 20} mục nữa`);

  if (APPLY && stale.length > 0) {
    await prisma.moduleItem.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
  }
  return { items: stale.length };
}

// ── D. Hoạt động không còn nằm trong chương nào ───────────────────────────
type OrphanKind = 'assignment' | 'quiz' | 'codeExercise' | 'practiceTest';

const ORPHAN_LABELS: Record<OrphanKind, string> = {
  assignment: 'Bài tập',
  quiz: 'Quiz',
  codeExercise: 'Bài code / Scratch',
  practiceTest: 'Đề ôn tập',
};

// Hoạt động được tạo rồi mới gắn ModuleItem ở lời gọi kế tiếp — bỏ qua bản ghi
// vừa tạo để không xoá nhầm thứ giáo viên đang soạn dở.
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

async function purgeOrphanActivities() {
  const cutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const where = { deletedAt: null, moduleItems: { none: {} }, createdAt: { lt: cutoff } };

  const found = {
    assignment: await prisma.assignment.findMany({ where, select: { id: true, title: true } }),
    quiz: await prisma.quiz.findMany({ where, select: { id: true, title: true } }),
    codeExercise: await prisma.codeExercise.findMany({ where, select: { id: true, title: true } }),
    practiceTest: await prisma.practiceTest.findMany({ where, select: { id: true, title: true } }),
  } satisfies Record<OrphanKind, { id: string; title: string }[]>;

  const total = Object.values(found).reduce((n, rows) => n + rows.length, 0);
  console.log(`\n[D] Hoạt động không thuộc chương nào (vẫn hiện ở tab riêng): ${total}`);
  if (total === 0) return { activities: 0 };

  for (const [kind, rows] of Object.entries(found) as [OrphanKind, typeof found.quiz][]) {
    for (const row of rows.slice(0, 20)) {
      console.log(`  - [${ORPHAN_LABELS[kind]}] "${row.title}"`);
    }
    if (rows.length > 20) console.log(`  ... và ${rows.length - 20} mục nữa`);
  }

  if (APPLY) {
    const deletedAt = new Date();
    await prisma.$transaction([
      prisma.assignment.updateMany({
        where: { id: { in: found.assignment.map((r) => r.id) } },
        data: { deletedAt },
      }),
      prisma.quiz.updateMany({
        where: { id: { in: found.quiz.map((r) => r.id) } },
        data: { deletedAt },
      }),
      prisma.codeExercise.updateMany({
        where: { id: { in: found.codeExercise.map((r) => r.id) } },
        data: { deletedAt },
      }),
      prisma.practiceTest.updateMany({
        where: { id: { in: found.practiceTest.map((r) => r.id) } },
        data: { deletedAt },
      }),
    ]);
  }
  return { activities: total };
}

async function main() {
  const dbHost = (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@');
  console.log(APPLY ? '=== CHẾ ĐỘ THỰC THI (--apply) ===' : '=== CHẠY THỬ (chưa xoá gì) ===');
  console.log(`DB:    ${dbHost || '(chưa đặt DATABASE_URL)'}`);
  console.log(`MinIO: ${minio ? 'đã cấu hình' : 'CHƯA cấu hình — sẽ bỏ qua phần xoá file'}`);

  const a = await purgeSoftDeletedCourses();
  const b = await purgeOrphanLessons();
  const c = await purgeStaleModuleItems();
  const d = await purgeOrphanActivities();

  console.log('\n──────── TỔNG KẾT ────────');
  console.log(`Khoá học xoá hẳn:      ${a.courses}`);
  console.log(`Bài giảng mồ côi:      ${b.lessons}`);
  console.log(`Mục rác trong chương:  ${c.items}`);
  console.log(`Hoạt động mồ côi:      ${d.activities} (chuyển vào thùng rác)`);
  console.log(`File trên MinIO:       ${a.files + b.files}`);
  console.log(
    APPLY
      ? '\nĐã thực thi xong.'
      : '\nChưa xoá gì. Chạy lại với --apply để thực thi (nên sao lưu DB trước).'
  );
  console.log('Lưu ý: ảnh chèn trong nội dung rich-text không nằm trong phạm vi script này.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
