import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { CourseMembersTabs } from '@/components/features/courses/CourseMembersTabs';
import { buttonVariants } from '@/components/ui/button';
import { hasMinRole } from '@/lib/permissions';
import type { CourseDetail, CourseMembersResponse, CourseGroupsData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: `Thành viên — ${course?.name ?? 'Khoá học'}` };
}

export default async function CoursePeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  if (!hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  // Quản lý thành viên & nhân sự (ghi danh, trợ giảng, đồng giảng, mã ghi danh)
  // là thao tác cấp khoá → chỉ ADMIN/chủ khoá; co-teacher chỉ xem.
  const canManage = course.viewerIsOwner;

  const [{ enrollments, tas, coTeachers }, groupsData] = await Promise.all([
    api
      .get<CourseMembersResponse>(`/courses/${course.id}/members`)
      .catch(() => ({ enrollments: [], tas: [], coTeachers: [] })),
    api
      .get<CourseGroupsData>(`/courses/${course.id}/groups`)
      .catch(() => ({ groupMode: 'NO_GROUPS', groups: [], groupings: [] }) as CourseGroupsData),
  ]);

  const totalTeachers = 1 + coTeachers.length;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/courses/${slug}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          ← {course.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Thành viên</h1>
        <p className="text-muted-foreground text-sm">
          {totalTeachers} giáo viên · {tas.length} trợ giảng · {enrollments.length} học sinh
        </p>
      </div>

      <CourseMembersTabs
        courseId={course.id}
        canManage={canManage}
        enrollments={enrollments}
        tas={tas}
        coTeachers={coTeachers}
        groupsData={groupsData}
        courseOwner={{
          id: course.owner.id,
          fullName: course.owner.fullName ?? null,
          firstName: course.owner.firstName,
          lastName: course.owner.lastName,
          email: course.owner.email ?? '',
          avatar: course.owner.avatar ?? null,
        }}
      />
    </div>
  );
}
