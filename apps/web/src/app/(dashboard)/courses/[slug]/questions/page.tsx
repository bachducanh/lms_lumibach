import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { listQuestionsByCategoryAction } from '@/actions/questions';
import { QuestionBankList } from '@/components/features/quiz/QuestionBankList';
import { hasMinRole } from '@/lib/permissions';
import { ArrowLeft } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Ngân hàng câu hỏi' };

export default async function QuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect('/courses');

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  const { categories, uncategorized } = await listQuestionsByCategoryAction(course.id);
  const totalQ = categories.reduce((s, c) => s + c.questions.length, 0) + uncategorized.length;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {categories.length} danh mục · {totalQ} câu hỏi · {course.name}
        </p>
      </div>

      <QuestionBankList
        categories={categories}
        uncategorized={uncategorized}
        courseId={course.id}
        courseSlug={slug}
        canManage={canManage}
      />
    </div>
  );
}
