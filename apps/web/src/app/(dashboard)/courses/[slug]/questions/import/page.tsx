import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { WordImportWorkspace } from '@/components/features/quiz/WordImportWorkspace';
import { buttonVariants } from '@/components/ui/button';
import type { CourseDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Nhập đề từ Word' };
export const dynamic = 'force-dynamic';

export default async function ImportCourseQuestionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  // Nhập hàng loạt là thao tác ghi; trợ giảng chỉ được xem nên chặn ngay ở trang.
  if (!course.viewerCanManage) redirect(`/courses/${slug}/questions`);

  const backHref = `/courses/${slug}/questions`;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Nhập đề từ Word</h1>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{course.name}</p>
        </div>
      </div>

      <WordImportWorkspace
        courseId={course.id}
        returnTo={backHref}
        tenNoiNhan={`ngân hàng câu hỏi của ${course.name}`}
      />
    </div>
  );
}
