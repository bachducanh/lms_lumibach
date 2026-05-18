import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CourseForm } from '@/components/features/courses/CourseForm';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Tạo khoá học mới' };

export default async function NewCoursePage() {
  const session = await auth();
  const role = session?.user?.role as UserRole;

  if (role !== 'ADMIN') {
    redirect('/courses');
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tạo khoá học mới</h1>
        <p className="text-muted-foreground text-sm">Điền thông tin để tạo khoá học</p>
      </div>
      <CourseForm mode="create" />
    </div>
  );
}
