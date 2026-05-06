import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { ArrowLeft } from 'lucide-react';
import { NewTopicForm } from './NewTopicForm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: `Tạo chủ đề mới — ${course?.name ?? 'Khoá học'}` };
}

export default async function NewTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}/forum`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Diễn đàn
        </Link>
      </div>

      <h1 className="text-xl font-bold">Tạo chủ đề mới</h1>

      <NewTopicForm courseId={course.id} slug={slug} />
    </div>
  );
}
