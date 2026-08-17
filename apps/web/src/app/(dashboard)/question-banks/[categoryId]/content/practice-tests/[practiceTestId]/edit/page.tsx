import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadBankOrNull } from '@/lib/bank-guard';
import { hasMinRole } from '@/lib/permissions';
import { PracticeTestForm } from '@/components/features/practice-tests/PracticeTestForm';
import type { PracticeTestDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Sửa đề luyện tập trong kho' };
export const dynamic = 'force-dynamic';

export default async function EditBankPracticeTestPage({
  params,
}: {
  params: Promise<{ categoryId: string; practiceTestId: string }>;
}) {
  const { categoryId, practiceTestId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  // Hai chốt khác nhau, cần cả hai: loadBankOrNull chứng minh người này soạn
  // được kho của danh mục; so khớp bankCategoryId chứng minh bản ghi nằm đúng
  // trong kho đó chứ không phải của danh mục khác.
  const loaded = await loadBankOrNull(categoryId);
  if (!loaded) notFound();
  const { api } = loaded;

  const practiceTest = await api
    .get<PracticeTestDetail>(`/practice-tests/${practiceTestId}`)
    .catch(() => null);
  if (!practiceTest || practiceTest.bankCategoryId !== categoryId) notFound();

  return (
    <PracticeTestForm
      mode="edit"
      owner={{ kind: 'bank', categoryId }}
      practiceTest={practiceTest}
      moduleId={practiceTest.moduleItems?.[0]?.moduleId}
    />
  );
}
