import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import type { CategoryContentBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Thêm bài giảng vào kho' };
export const dynamic = 'force-dynamic';

export default async function NewBankLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { categoryId } = await params;
  const { module: moduleId } = await searchParams;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');
  if (!moduleId) redirect(`/question-banks/${categoryId}/content`);

  // Gọi kho để vừa kiểm quyền vừa xác nhận chương thuộc đúng danh mục này.
  const api = apiServerClient(await cookies());
  const data = await api
    .get<CategoryContentBankData>(`/modules/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data || !data.modules.some((m) => m.id === moduleId)) notFound();

  return (
    <div className="max-w-4xl">
      <LessonEditor mode="create" owner={{ kind: 'bank', categoryId }} moduleId={moduleId} />
    </div>
  );
}
