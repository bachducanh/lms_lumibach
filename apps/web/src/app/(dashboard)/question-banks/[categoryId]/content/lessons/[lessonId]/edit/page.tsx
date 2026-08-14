import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import type { CategoryContentBankData, LessonDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Sửa bài giảng trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string; lessonId: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { categoryId, lessonId } = await params;
  const { module: moduleId } = await searchParams;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const [data, lesson] = await Promise.all([
    api.get<CategoryContentBankData>(`/modules/bank-categories/${categoryId}`).catch(() => null),
    api.get<LessonDetail>(`/lessons/${lessonId}`).catch(() => null),
  ]);
  if (!data || !lesson) notFound();

  // Bài giảng phải thật sự nằm trong kho của danh mục này — không tin tham số URL.
  const owningModule = data.modules.find((m) => m.items.some((i) => i.lessonId === lessonId));
  if (!owningModule) notFound();

  return (
    <div className="max-w-4xl">
      <LessonEditor
        mode="edit"
        owner={{ kind: 'bank', categoryId }}
        moduleId={moduleId ?? owningModule.id}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          estimatedMinutes: lesson.estimatedMinutes,
        }}
        attachments={lesson.attachments}
      />
    </div>
  );
}
