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

  if (!hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' ||
    (role === 'TEACHER' && course.ownerId === session?.user?.id);

  const { enrollments, tas, coTeachers } = await listCourseMembersAction(course.id);

  const totalTeachers = 1 + coTeachers.length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/courses/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← {course.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Thành viên</h1>
        <p className="text-sm text-muted-foreground">
          {totalTeachers} giáo viên · {tas.length} trợ giảng · {enrollments.length} học sinh
        </p>
      </div>

      <PeoplePanel
        courseId={course.id}
        canManage={canManage}
        enrollments={enrollments}
        tas={tas}
        coTeachers={coTeachers}
        courseOwner={{
          id: course.owner.id,
          fullName: course.owner.fullName ?? null,
          firstName: course.owner.firstName,
          lastName: course.owner.lastName,
          email: course.owner.email,
          avatar: course.owner.avatar ?? null,
        }}
      />

    </div>
  );
}
