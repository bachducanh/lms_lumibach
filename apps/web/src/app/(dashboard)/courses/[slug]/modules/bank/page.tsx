import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, ModuleWithItems } from '@lumibach/types';
import { ContentBankBrowser } from '@/components/features/courses/ContentBankBrowser';
import { ArrowLeft, Library } from 'lucide-react';

export const metadata = { title: 'Ngân hàng nội dung' };

export default async function ContentBankPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  // Nhân bản là sửa nội dung khoá — trợ giảng chỉ xem, không chép.
  if (!course.viewerCanManage) redirect(`/courses/${slug}/modules`);

  const modules = await api
    .get<ModuleWithItems[]>('/modules', { query: { courseId: course.id } })
    .catch(() => [] as ModuleWithItems[]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href={`/courses/${slug}/modules`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Chương của khoá học
      </Link>

      <div className="flex items-center gap-2">
        <Library className="text-primary h-5 w-5" />
        <div>
          <h1 className="text-2xl font-bold">Ngân hàng nội dung</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Hoạt động được các khoá cùng nhánh danh mục chia sẻ. Chép về là có bản riêng — sửa sau
            này không ảnh hưởng lớp khác. Bản sao luôn ở dạng nháp.
          </p>
        </div>
      </div>

      <ContentBankBrowser courseId={course.id} modules={modules} />
    </div>
  );
}
