import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import * as archiverNs from 'archiver';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { minioClient, BUCKET_FILES, isMinioConfigured } from '@/lib/storage';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

// @types/archiver (v7) chưa có named export ZipArchive của archiver v8 — khai báo tối thiểu và ép kiểu.
interface ArchiveLike {
  append(source: Buffer | NodeJS.ReadableStream, opts: { name: string }): void;
  finalize(): Promise<void>;
  destroy(err?: Error): void;
  on(event: 'warning' | 'error', listener: (err: Error) => void): void;
}
const ZipArchive = (
  archiverNs as unknown as {
    ZipArchive: new (opts?: { zlib?: { level?: number } }) => ArchiveLike;
  }
).ZipArchive;

// Làm sạch tên folder/file để hợp lệ trong ZIP (giữ dấu tiếng Việt và dấu gạch nối, bỏ ký tự cấm).
function sanitizeSegment(s: string): string {
  const cleaned = (s || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'untitled';
}

function objectNameFromUrl(url: string): string | null {
  const prefix = `/storage/${BUCKET_FILES}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch
  );
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Buffer));
  return Buffer.concat(chunks);
}

// Đảm bảo tên không trùng trong một tập (folder, hoặc file trong cùng folder).
function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${stem} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!userId) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!hasMinRole(role, 'TA'))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  if (!isMinioConfigured())
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });

  const { assignmentId } = await params;

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: {
      id: true,
      title: true,
      course: {
        select: {
          ownerId: true,
          teachingAssistants: { where: { userId }, select: { id: true } },
          coTeachers: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  if (!assignment) return NextResponse.json({ error: 'Bài tập không tồn tại' }, { status: 404 });

  const c = assignment.course;
  const canAccess =
    hasMinRole(role, 'ADMIN') ||
    c.ownerId === userId ||
    c.teachingAssistants.length > 0 ||
    c.coTeachers.length > 0;
  if (!canAccess) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  // Lấy bài nộp mới nhất (đã nộp, bỏ DRAFT) của mỗi học sinh.
  const submissions = await prisma.submission.findMany({
    where: { assignmentId, status: { not: 'DRAFT' } },
    orderBy: [{ studentId: 'asc' }, { attemptNumber: 'desc' }],
    include: {
      files: { select: { name: true, url: true } },
      student: { select: { fullName: true, firstName: true, lastName: true, email: true } },
    },
  });
  const seen = new Set<string>();
  const latest = submissions.filter((s) => {
    if (seen.has(s.studentId)) return false;
    seen.add(s.studentId);
    return true;
  });

  if (latest.length === 0)
    return NextResponse.json({ error: 'Chưa có bài nộp nào để tải.' }, { status: 404 });

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('warning', () => {});
  archive.on('error', (err) => console.error('[DOWNLOAD ALL] archive error', err));

  // Bơm dữ liệu vào archive song song với việc stream response về client.
  void (async () => {
    try {
      const usedFolders = new Set<string>();
      for (const sub of latest) {
        const student = sub.student;
        const studentName =
          student?.fullName?.trim() ||
          [student?.lastName, student?.firstName].filter(Boolean).join(' ').trim() ||
          student?.email ||
          'Học sinh';
        const folder = uniqueName(
          sanitizeSegment(`${studentName} - ${assignment.title}`),
          usedFolders
        );

        let entriesInFolder = 0;

        if (sub.content && sub.content.trim()) {
          const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(
            studentName
          )}</title></head><body>${sub.content}</body></html>`;
          archive.append(Buffer.from(html, 'utf8'), { name: `${folder}/noi-dung.html` });
          entriesInFolder++;
        }

        const usedNames = new Set<string>();
        for (const f of sub.files) {
          const objectName = objectNameFromUrl(f.url);
          const fileName = uniqueName(sanitizeSegment(f.name) || 'file', usedNames);
          if (!objectName) continue;
          try {
            const objStream = (await minioClient.getObject(BUCKET_FILES, objectName)) as Readable;
            const buf = await streamToBuffer(objStream);
            archive.append(buf, { name: `${folder}/${fileName}` });
            entriesInFolder++;
          } catch (err) {
            archive.append(Buffer.from(`Không tải được file: ${f.name}\n${String(err)}`, 'utf8'), {
              name: `${folder}/${fileName}.LOI.txt`,
            });
            entriesInFolder++;
          }
        }

        // Tránh folder rỗng (trường hợp nộp không nội dung lẫn file).
        if (entriesInFolder === 0) {
          archive.append(Buffer.from('Bài nộp không có nội dung hay file đính kèm.', 'utf8'), {
            name: `${folder}/(trống).txt`,
          });
        }
      }
      await archive.finalize();
    } catch (err) {
      console.error('[DOWNLOAD ALL] build error', err);
      archive.destroy(err as Error);
    }
  })();

  const zipName = `${sanitizeSegment(assignment.title)} - bai nop.zip`;
  const asciiName = zipName.replace(/[^\x20-\x7E]/g, '_');
  const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        zipName
      )}`,
      'Cache-Control': 'no-store',
    },
  });
}
