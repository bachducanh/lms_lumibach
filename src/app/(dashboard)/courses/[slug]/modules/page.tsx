import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCourseBySlugAction } from '@/actions/courses';
import { listModulesAction } from '@/actions/modules';
import { ModuleList } from '@/components/features/courses/ModuleList';
import { buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: `Nội dung — ${course?.name ?? 'Khoá học'}` };
}

export default async function CourseModulesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const isStudent = role === 'STUDENT';
  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  if (isStudent && course.status !== 'PUBLISHED') {
    redirect(`/courses/${slug}`);
  }

  const [modules, completions] = await Promise.all([
    listModulesAction(course.id, isStudent),
    userId
      ? prisma.moduleItemCompletion.findMany({
          where: { userId, moduleItem: { module: { courseId: course.id } } },
          select: { moduleItemId: true },
        })
      : Promise.resolve([]),
  ]);

  const completedIds = new Set(completions.map((c) => c.moduleItemId));
  const totalItems = modules.reduce((s, m) => s + m.items.length, 0);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/courses/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← {course.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Nội dung khoá học</h1>
        <p className="text-sm text-muted-foreground">
          {modules.length} chương · {totalItems} bài học
          {isStudent && completedIds.size > 0 && ` · ${completedIds.size}/${totalItems} hoàn thành`}
        </p>
      </div>

      <ModuleList
        courseSlug={slug}
        courseId={course.id}
        modules={modules}
        canManage={canManage}
        completedIds={completedIds}
      />
    </div>
  );
}
