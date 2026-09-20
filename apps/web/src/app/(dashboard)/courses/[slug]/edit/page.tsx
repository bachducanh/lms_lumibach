import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { apiServerClient } from '@/lib/api-client';
import { CourseForm } from '@/components/features/courses/CourseForm';
import type { CourseDetail } from '@lumibach/types';

export const metadata = { title: 'Chỉnh sửa khoá học' };

export default async function EditCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  // Sửa khoá là thao tác cấp khoá → chỉ ADMIN/chủ khoá (không gồm co-teacher).
  if (!course.viewerIsOwner) redirect(`/courses/${slug}`);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Chỉnh sửa khoá học
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{course.name}</p>
      </div>
      <CourseForm mode="edit" course={course} />
    </div>
  );
}
