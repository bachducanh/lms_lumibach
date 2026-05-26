import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// /portfolio → hồ sơ của chính người dùng hiện tại.
export default async function PortfolioRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  redirect(`/courses/${slug}/portfolio/${session.user.id}`);
}
