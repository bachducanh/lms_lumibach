import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { PracticeTestRunner } from '@/components/features/practice-tests/PracticeTestRunner';
import { buttonVariants } from '@/components/ui/button';
import { hasMinRole } from '@/lib/permissions';
import type { CourseDetail, PracticeTestPreview } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, Eye, FileQuestion } from 'lucide-react';

export const metadata = { title: 'Xem thử đề luyện tập' };

export default async function PracticeTestPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string }>;
}) {
  const { slug, practiceTestId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) {
    redirect(`/courses/${slug}/practice-tests/${practiceTestId}`);
  }

  const api = apiServerClient(await cookies());
  const [course, practiceTest] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<PracticeTestPreview>(`/practice-tests/${practiceTestId}/preview`).catch(() => null),
  ]);
  if (!course || !practiceTest) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/courses/${slug}/practice-tests/${practiceTestId}`}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">Xem thử</span>
            <span className="text-muted-foreground">/</span>
            <FileQuestion className="h-4 w-4 text-cyan-500" />
            <span className="text-muted-foreground truncate text-sm">{practiceTest.title}</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Câu trả lời không được lưu, chỉ dùng để kiểm tra giao diện và đáp án.
          </p>
        </div>
      </div>

      <PracticeTestRunner practiceTest={practiceTest} courseSlug={slug} preview />
    </div>
  );
}
