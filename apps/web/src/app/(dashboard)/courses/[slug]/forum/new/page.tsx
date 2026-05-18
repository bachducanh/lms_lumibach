import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { ArrowLeft } from 'lucide-react';
import { NewTopicForm } from './NewTopicForm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: `Tạo chủ đề mới — ${course?.name ?? 'Khoá học'}` };
}

export default async function NewTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${slug}/forum`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
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
