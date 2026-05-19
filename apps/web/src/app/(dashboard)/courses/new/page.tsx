import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { CourseForm } from '@/components/features/courses/CourseForm';
import type { UserRole } from '@lumibach/db';
import type { CategoryDetail } from '@lumibach/types';

export const metadata = { title: 'Tạo khoá học mới' };

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = session?.user?.role as UserRole;

  if (role !== 'ADMIN') {
    redirect('/courses');
  }

  const sp = await searchParams;
  const categoryId = typeof sp.categoryId === 'string' ? sp.categoryId : undefined;
  const api = apiServerClient(await cookies());
  const category = categoryId
    ? await api.get<CategoryDetail>(`/categories/${categoryId}`).catch(() => null)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tạo khoá học mới</h1>
        <p className="text-muted-foreground text-sm">Điền thông tin để tạo khoá học</p>
      </div>
      <CourseForm
        mode="create"
        initialCategoryId={category?.children.length === 0 ? category.id : undefined}
        initialCategoryLabel={
          category?.children.length === 0
            ? category.breadcrumb.map((c) => c.name).join(' / ')
            : undefined
        }
      />
    </div>
  );
}
