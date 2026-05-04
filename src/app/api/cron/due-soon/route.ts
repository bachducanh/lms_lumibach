import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

// Endpoint này gọi bằng cron job mỗi giờ (ví dụ: cron-job.org)
// Bảo vệ bằng CRON_SECRET trong env
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now       = new Date();
  const in24h     = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const since1h   = new Date(now.getTime() - 60 * 60 * 1000); // tránh gửi lại trong 1h

  // Tìm assignments sắp đến hạn trong 24h tới
  const assignments = await prisma.assignment.findMany({
    where: {
      dueDate:   { gte: now, lte: in24h },
      status:    'PUBLISHED',
      deletedAt: null,
    },
    select: {
      id: true, title: true, dueDate: true,
      course: { select: { id: true, slug: true, enrollments: { select: { userId: true } } } },
    },
  });

  let created = 0;

  for (const assignment of assignments) {
    for (const enrollment of assignment.course.enrollments) {
      // Kiểm tra đã gửi thông báo chưa (trong 1h trước)
      const existing = await (prisma as any).notification.findFirst({
        where: {
          userId:    enrollment.userId,
          type:      'ASSIGNMENT_DUE_SOON',
          title:     { contains: assignment.title },
          createdAt: { gte: since1h },
        },
      });
      if (existing) continue;

      // Kiểm tra học sinh đã nộp chưa
      const submitted = await prisma.submission.findFirst({
        where: {
          assignmentId: assignment.id,
          studentId:    enrollment.userId,
          status:       { notIn: ['DRAFT'] },
        },
      });
      if (submitted) continue;

      const hoursLeft = Math.round((assignment.dueDate!.getTime() - now.getTime()) / 3_600_000);
      await createNotification({
        userId: enrollment.userId,
        type:   'ASSIGNMENT_DUE_SOON',
        title:  `Bài tập "${assignment.title}" sắp đến hạn`,
        body:   `Còn khoảng ${hoursLeft} giờ. Hãy hoàn thành và nộp bài đúng hạn.`,
        link:   `/courses/${assignment.course.slug}`,
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, notificationsCreated: created });
}
