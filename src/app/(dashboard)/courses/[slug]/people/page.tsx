import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { listCourseMembersAction } from '@/actions/enrollments';
import { PeoplePanel } from '@/components/features/courses/PeoplePanel';
import { buttonVariants } from '@/components/ui/button';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: `Thành viên — ${course?.name ?? 'Khoá học'}` };
}

export default async function CoursePeoplePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  // Chỉ TEACHER/ADMIN/TA mới truy cập được trang này
  if (!hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' ||
    (role === 'TEACHER' && course.ownerId === session?.user?.id);

  const { enrollments, tas } = await listCourseMembersAction(course.id);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/courses/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← {course.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Thành viên</h1>
        <p className="text-sm text-muted-foreground">{enrollments.length} học sinh · {tas.length} trợ giảng</p>
      </div>

      <PeoplePanel
        courseId={course.id}
        canManage={canManage}
        enrollments={enrollments}
        tas={tas}
      />
    </div>
  );
}
