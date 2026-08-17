import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { PracticeTestForm } from '@/components/features/practice-tests/PracticeTestForm';
import { bankContentHref } from '@/lib/activity-owner';
import type { CategoryContentBankData } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Thêm đề luyện tập vào kho' };
export const dynamic = 'force-dynamic';

/**
 * Đề luyện tập là loại DUY NHẤT không tạo khung rỗng rồi sửa sau như các loại
 * khác: `PracticeTest.pdfUrl` là cột NOT NULL nên phải có file PDF ngay từ lúc
 * tạo. Vì thế nó dùng biểu mẫu đầy đủ ở chế độ `create`.
 */
export default async function NewBankPracticeTestPage({
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
  if (!moduleId) redirect(bankContentHref(categoryId));

  // Gọi kho để vừa kiểm quyền vừa xác nhận chương thuộc đúng danh mục này.
  const api = apiServerClient(await cookies());
  const data = await api
    .get<CategoryContentBankData>(`/modules/bank-categories/${categoryId}`)
    .catch(() => null);
  if (!data || !data.modules.some((m) => m.id === moduleId)) notFound();

  return (
    <PracticeTestForm mode="create" owner={{ kind: 'bank', categoryId }} moduleId={moduleId} />
  );
}
