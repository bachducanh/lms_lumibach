import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, QuestionCategory } from '@lumibach/types';
import { SharedBankBrowser } from '@/components/features/quiz/SharedBankBrowser';
import { ArrowLeft, Library } from 'lucide-react';

export const metadata = { title: 'Ngân hàng chung' };

export default async function SharedBankPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  // Chép câu hỏi về khoá là sửa nội dung khoá — trợ giảng chỉ được xem, không chép.
  if (!course.viewerCanManage) redirect(`/courses/${slug}/questions`);

  const categories = await api
    .get<QuestionCategory[]>('/questions/categories', { query: { courseId: course.id } })
    .catch(() => [] as QuestionCategory[]);

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/courses/${slug}/questions`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Ngân hàng câu hỏi của khoá
      </Link>

      <div className="flex items-center gap-2">
        <Library className="text-primary h-5 w-5" />
        <div>
          <h1 className="text-2xl font-bold">Ngân hàng chung</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Câu hỏi được các khoá học cùng nhánh danh mục chia sẻ. Chép về là có một bản riêng — sửa
            sau này không ảnh hưởng lớp khác.
          </p>
        </div>
      </div>

      <SharedBankBrowser courseId={course.id} categories={categories} />
    </div>
  );
}
